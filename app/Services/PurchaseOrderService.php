<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Product;
use App\Models\InventoryLog;
use Illuminate\Support\Facades\DB;
use Exception;

class PurchaseOrderService
{
    /**
     * Create a new pending Purchase Order
     */
    public function createOrder(array $data): PurchaseOrder
    {
        return DB::transaction(function () use ($data) {
            $exchangeRate = (float) ($data['exchange_rate'] ?: 1.0);
            
            // Calculate total goods cost in foreign currency (or local if exchange_rate is 1)
            $totalGoodsCost = 0;
            foreach ($data['items'] as $item) {
                $totalGoodsCost += ($item['quantity'] * $item['unit_cost']);
            }
            
            $supplierFee = (float) ($data['supplier_fee'] ?: 0);
            $paidAmount = (float) ($data['paid_amount'] ?: 0);
            
            // Grand Total (in MMK)
            $grandTotal = ($totalGoodsCost + $supplierFee) * $exchangeRate;
            
            // Payment Status
            $paymentStatus = 'unpaid';
            if ($paidAmount > 0) {
                $paymentStatus = $paidAmount >= $grandTotal ? 'paid' : 'partial';
            }

            // Create the main PO
            $po = PurchaseOrder::create([
                'batch_name' => $data['batch_name'],
                'supplier_id' => $data['supplier_id'] ?: null,
                'local_shop_name' => $data['shop_name'] ?: null,
                'status' => 'pending',
                'exchange_rate' => $exchangeRate,
                'total_goods_cost' => $totalGoodsCost,
                'supplier_fee' => $supplierFee,
                'cargo_fee' => 0,
                'local_deli_fee' => 0,
                'grand_total' => $grandTotal,
                'payment_status' => $paymentStatus,
                'paid_amount' => $paidAmount,
                'note' => $data['note'] ?? null,
            ]);

            // Create the items
            foreach ($data['items'] as $item) {
                $originalCost = $item['unit_cost'];
                $unitCostMmk = $originalCost * $exchangeRate;
                $lineTotalMmk = $item['quantity'] * $unitCostMmk;

                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'original_cost' => $originalCost,
                    'unit_cost' => $unitCostMmk,
                    'line_total' => $lineTotalMmk,
                ]);

                // Increment pending_stock for the product
                $product = Product::lockForUpdate()->findOrFail($item['product_id']);
                $product->increment('pending_stock', $item['quantity']);
            }

            return $po;
        });
    }

    /**
     * Mark a PO as arrived, finalize costs, and update inventory.
     */
    public function markAsArrived(PurchaseOrder $po, array $arrivalData): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $arrivalData) {
            if ($po->status === 'arrived') {
                throw new Exception("This order has already arrived.");
            }

            // Lock PO and items
            $po = PurchaseOrder::lockForUpdate()->findOrFail($po->id);
            $items = $po->items()->lockForUpdate()->get();

            // Update PO final costs
            $cargoFee = (float) ($arrivalData['cargo_fee'] ?? 0);
            $localDeliFee = (float) ($arrivalData['local_deli_fee'] ?? 0);
            $adjustmentAmount = (float) ($arrivalData['adjustment_amount'] ?? 0);
            $adjustmentReason = $arrivalData['adjustment_reason'] ?? null;
            
            $po->cargo_fee = $cargoFee;
            $po->local_deli_fee = $localDeliFee;
            $po->adjustment_amount = $adjustmentAmount;
            $po->adjustment_reason = $adjustmentReason;
            
            // Add to grand total
            $po->grand_total = $po->grand_total + $cargoFee + $localDeliFee + $adjustmentAmount;
            
            // Automatically mark as fully paid
            $po->paid_amount = $po->grand_total;
            $po->payment_status = 'paid';

            $po->status = 'arrived';
            $po->save();

            // Distribute shipping costs to products to update their base_cost
            $totalQuantity = $items->sum('quantity');
            $shippingCostPerItem = $totalQuantity > 0 ? (($cargoFee + $localDeliFee) / $totalQuantity) : 0;

            foreach ($items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                
                // Final unit cost includes the original unit cost (converted to MMK) + shipping cost per item
                // + supplier fee proportion if you want to be extremely exact, but usually shipping is the main extra cost.
                $supplierFeePerItem = $totalQuantity > 0 ? (($po->supplier_fee * $po->exchange_rate) / $totalQuantity) : 0;
                
                $finalUnitCostMmk = $item->unit_cost + $shippingCostPerItem + $supplierFeePerItem;

                // Update product stock, decrement pending stock, and update base cost
                $newStockLevel = $product->stock_quantity + $item->quantity;
                $newPendingStock = max(0, $product->pending_stock - $item->quantity);
                
                // Usually base cost is a weighted average of old stock vs new stock, 
                // but for simplicity we'll just set it to the latest landed cost, 
                // or you can implement weighted average here.
                // Let's use latest landed cost for now.
                $product->update([
                    'stock_quantity' => $newStockLevel,
                    'pending_stock' => $newPendingStock,
                    'base_cost' => $finalUnitCostMmk,
                ]);

                // Create Inventory Log
                InventoryLog::create([
                    'shop_id' => $po->shop_id,
                    'product_id' => $product->id,
                    'quantity_change' => $item->quantity,
                    'new_stock_level' => $newStockLevel,
                    'reason' => 'purchase_arrived',
                    'reference_type' => PurchaseOrder::class,
                    'reference_id' => $po->id,
                    'note' => "PO Arrived: {$po->batch_name}",
                ]);
            }

            return $po;
        });
    }
}
