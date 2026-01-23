<?php

namespace App\Services;

use App\Models\Product;
use App\Models\InventoryLog;
use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;

class PurchaseOrderService
{
    public function createBatch(array $data, array $items)
    {
        return DB::transaction(function () use ($data, $items) {
            // 1. Setup Defaults
            $rate = $data['exchange_rate'] ?? 1; // Default to 1 (Local)
            $supplierFee = $data['supplier_fee'] ?? 0;
            $cargoFee = $data['cargo_fee'] ?? 0;
            $localDeli = $data['local_deli_fee'] ?? 0;
            $paidAmount = $data['paid_amount'] ?? 0;

            // 2. Create the PO Shell (We fill totals later)
            $po = PurchaseOrder::create([
                'batch_name' => $data['batch_name'],
                'supplier_id' => $data['supplier_id'] ?? null,
                'status' => 'pending',
                'exchange_rate' => $rate,
                'supplier_fee' => $supplierFee,
                'cargo_fee' => $cargoFee,
                'local_deli_fee' => $localDeli,
                'note' => $data['note'] ?? null,
                'paid_amount' => $paidAmount,
                // Determine Payment Status automatically
                'payment_status' => $paidAmount > 0 ? 'partial' : 'unpaid'
            ]);

            // 3. Process Items & Calculate Goods Cost
            $totalGoodsCost = 0;

            foreach ($items as $item) {
                $product = Product::findOrFail($item['product_id']);

                // CRITICAL FIX 1: Update Pending Stock immediately
                // This tells the system "10 items are on the way"
                $product->increment('pending_stock', $item['quantity']);

                $originalCost = $item['unit_cost']; // 30 CNY

                // Convert to MMK
                $mmkCost = $originalCost * $rate; // 15,000 MMK

                // Line Total (in MMK)
                $lineTotal = $mmkCost * $item['quantity'];

                $totalGoodsCost += $lineTotal;

                $po->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],

                    // Store BOTH
                    'original_cost' => $originalCost, // 30
                    'unit_cost' => $mmkCost,          // 15000

                    'line_total' => $lineTotal,
                ]);
            }

            $grandTotal = $totalGoodsCost + $po->supplier_fee;

            $paymentStatus = 'unpaid';
            if ($po->paid_amount >= $grandTotal) {
                $paymentStatus = 'paid';
            } elseif ($po->paid_amount > 0) {
                $paymentStatus = 'partial';
            }

            $po->update([
                'total_goods_cost' => $totalGoodsCost,
                'grand_total' => $grandTotal,
                'payment_status' => $paymentStatus
            ]);

            return $po->load('items');
        });
    }

    public function markAsArrived($id, array $data = [])
    {
        return DB::transaction(function () use ($id, $data) {
            $po = PurchaseOrder::findOrFail($id);

            if ($po->status === 'arrived') {
                return $po; // Prevent double execution
            }

            // 1. Update Fees (If provided)
            $po->cargo_fee = $data['cargo_fee'] ?? $po->cargo_fee;
            $po->local_deli_fee = $data['local_deli_fee'] ?? $po->local_deli_fee;

            // 2. Update Payment (Add the new payment to the old total)
            if (isset($data['add_payment_amount'])) {
                $po->paid_amount += $data['add_payment_amount'];
            }

            // 3. Recalculate Grand Total
            // (Goods Cost + Supplier Fee + Cargo + Deli)
            $grandTotal = $po->total_goods_cost + $po->supplier_fee + $po->cargo_fee + $po->local_deli_fee;
            $po->grand_total = $grandTotal;

            $totalBatchQuantity = $po->items->sum('quantity');

            $feePerItem = 0;
            if ($totalBatchQuantity > 0) {
                // (SupplierFee + Cargo + Deli) / Total Items
                $totalFees = $po->supplier_fee + $po->cargo_fee + $po->local_deli_fee;
                $feePerItem = $totalFees / $totalBatchQuantity;
            }

            // 4. Update Payment Status automatically
            // If Paid >= Total, then status is 'paid'.
            if ($po->paid_amount >= $grandTotal) {
                $po->payment_status = 'paid';
            } elseif ($po->paid_amount > 0) {
                $po->payment_status = 'partial';
            } else {
                $po->payment_status = 'unpaid';
            }

            // 5. Update Status & Stock
            $po->status = 'arrived';
            $po->save(); // Save the PO changes

            foreach ($po->items as $item) {

                $product = $item->product;

                // A. Calculate the REAL cost of this specific item in this batch
                // Real Cost = (Buying Price in MMK) + (Share of Fees)
                // Note: item->unit_cost is the Source Price (e.g. 10 CNY).
                // We need to convert it to MMK first using the PO's rate.
                $finalBatchUnitCost = $item->unit_cost + $feePerItem;

                // Weighted Average Formula
                // ((OldQty * OldCost) + (NewQty * NewBatchCost)) / TotalQty
                $oldValue = $product->stock_quantity * $product->base_cost;
                $newValue = $item->quantity * $finalBatchUnitCost;
                $totalQty = $product->stock_quantity + $item->quantity;

                // Handle division by zero edge case (first stock)
                $newAverageCost = ($totalQty > 0) ? ($oldValue + $newValue) / $totalQty : $finalBatchUnitCost;

                // C. Save to Product
                $product->base_cost = $newAverageCost;
                $product->stock_quantity += $item->quantity;
                $product->pending_stock -= $item->quantity;
                $product->save();

                // D. Log it
                InventoryLog::create([
                    'shop_id' => $po->shop_id,
                    'product_id' => $product->id,
                    'quantity_change' => $item->quantity,
                    'new_stock_level' => $product->stock_quantity,
                    'reason' => 'purchase_arrived',
                    'reference_type' => PurchaseOrder::class,
                    'reference_id' => $po->id,
                    'note' => "Arrived. Cost updated to " . number_format($newAverageCost)
                ]);
            }

            return $po;
        });
    }
}
