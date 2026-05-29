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
                    'retail_price' => $item['retail_price'] ?? null,
                ]);

                // Increment pending_stock for the product
                $product = Product::lockForUpdate()->findOrFail($item['product_id']);
                $product->increment('pending_stock', $item['quantity']);
            }

            $po->logAction('created', [
                'batch_name' => $data['batch_name'],
                'supplier_id' => $data['supplier_id']
            ]);

            return $po;
        });
    }

    /**
     * Update a pending Purchase Order
     */
    public function updateOrder($id, array $data): PurchaseOrder
    {
        return DB::transaction(function () use ($id, $data) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);

            if ($po->status !== 'pending') {
                throw new Exception("Only pending purchase orders can be edited.");
            }

            $exchangeRate = (float) ($data['exchange_rate'] ?: 1.0);
            
            // Calculate total goods cost in foreign currency
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

            // Track stock changes to validate deficit later
            $stockChanges = [];

            // 1. Revert old items
            $oldItems = $po->items()->get();
            foreach ($oldItems as $oldItem) {
                if (!isset($stockChanges[$oldItem->product_id])) {
                    $stockChanges[$oldItem->product_id] = 0;
                }
                $stockChanges[$oldItem->product_id] -= $oldItem->quantity;
            }

            // Delete old items
            $po->items()->delete();

            // 2. Create new items and apply new stock
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
                    'retail_price' => $item['retail_price'] ?? null,
                ]);

                if (!isset($stockChanges[$item['product_id']])) {
                    $stockChanges[$item['product_id']] = 0;
                }
                $stockChanges[$item['product_id']] += $item['quantity'];
            }

            // 3. Apply stock changes to Products and validate deficit
            foreach ($stockChanges as $productId => $change) {
                if ($change !== 0) {
                    $product = Product::lockForUpdate()->findOrFail($productId);
                    $newPendingStock = max(0, $product->pending_stock + $change);

                    if ($product->stock_quantity < 0) {
                        $deficit = abs($product->stock_quantity);
                        if ($newPendingStock < $deficit) {
                            throw new Exception("Cannot update PO because {$product->name} has pending sales orders that rely on this incoming stock. The new quantity is insufficient.");
                        }
                    }

                    $product->update(['pending_stock' => $newPendingStock]);
                }
            }

            // Update PO
            $po->fill([
                'batch_name' => $data['batch_name'],
                'supplier_id' => $data['supplier_id'] ?: null,
                'local_shop_name' => $data['shop_name'] ?: null,
                'exchange_rate' => $exchangeRate,
                'total_goods_cost' => $totalGoodsCost,
                'supplier_fee' => $supplierFee,
                'grand_total' => $grandTotal,
                'payment_status' => $paymentStatus,
                'paid_amount' => $paidAmount,
                'note' => $data['note'] ?? null,
            ]);

            $changes = [];
            foreach ($po->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at') continue;
                $changes[$key] = [
                    'old' => $po->getOriginal($key),
                    'new' => $newValue
                ];
            }

            // For PO edits, we always rebuild items, so we'll just indicate items were updated.
            $changes['items'] = [
                'old' => '...',
                'new' => 'updated'
            ];

            $po->logAction('updated', ['changes' => $changes]);
            $po->saveQuietly(); // saveQuietly because logAction already saves if it exists, but logAction does saveQuietly anyway

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

            // Map received items
            $receivedItemsMap = collect($arrivalData['received_items'] ?? [])->keyBy('id');
            
            $totalReceivedQuantity = 0;
            $newTotalGoodsCost = 0;

            foreach ($items as $item) {
                $receivedQty = $receivedItemsMap->has($item->id) 
                    ? (int) $receivedItemsMap->get($item->id)['received_quantity'] 
                    : $item->quantity;

                $item->received_quantity = $receivedQty;
                $item->line_total = $receivedQty * $item->unit_cost;
                
                $totalReceivedQuantity += $receivedQty;
                $newTotalGoodsCost += ($receivedQty * $item->original_cost);
            }

            // Distribute shipping & adjustment costs to products to update their base_cost
            $shippingAndAdjustmentTotal = $cargoFee + $localDeliFee + $adjustmentAmount;
            $shippingCostPerItem = $totalReceivedQuantity > 0 ? ($shippingAndAdjustmentTotal / $totalReceivedQuantity) : 0;
            $supplierFeePerItem = $totalReceivedQuantity > 0 ? (($po->supplier_fee * $po->exchange_rate) / $totalReceivedQuantity) : 0;

            foreach ($items as $item) {
                $receivedQty = $item->received_quantity;
                $item->save(); // Save updated received_quantity and line_total

                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                
                $finalUnitCostMmk = $item->unit_cost + $shippingCostPerItem + $supplierFeePerItem;

                $retailPrice = $receivedItemsMap->has($item->id) && isset($receivedItemsMap->get($item->id)['retail_price'])
                    ? $receivedItemsMap->get($item->id)['retail_price']
                    : null;

                // Calculate deficit (pre-ordered items)
                $currentStock = $product->stock_quantity;
                $batchRemainingQty = $receivedQty;

                if ($currentStock < 0) {
                    $deficit = abs($currentStock);
                    $deduction = min($deficit, $receivedQty);
                    $batchRemainingQty = $receivedQty - $deduction;
                }

                // Create ProductBatch instead of updating global base_cost
                if ($receivedQty > 0) {
                    \App\Models\ProductBatch::create([
                        'shop_id' => $po->shop_id,
                        'product_id' => $product->id,
                        'reference_type' => PurchaseOrder::class,
                        'reference_id' => $po->id,
                        'initial_quantity' => $receivedQty,
                        'remaining_quantity' => $batchRemainingQty,
                        'unit_cost' => $finalUnitCostMmk,
                        'retail_price' => $retailPrice,
                    ]);
                }

                // Update product stock (only received items), decrement pending stock (by original ordered quantity)
                $newStockLevel = $product->stock_quantity + $receivedQty;
                $newPendingStock = max(0, $product->pending_stock - $item->quantity);
                
                $updateData = [
                    'stock_quantity' => $newStockLevel,
                    'pending_stock' => $newPendingStock,
                ];

                if ($retailPrice !== null && $retailPrice !== '') {
                    $updateData['retail_price'] = $retailPrice;
                }

                $product->update($updateData);

                // Create Inventory Log
                $note = "PO Arrived: {$po->batch_name}";
                if ($receivedQty !== $item->quantity) {
                    $note .= " (Ordered: {$item->quantity}, Received: {$receivedQty})";
                }
                
                InventoryLog::create([
                    'shop_id' => $po->shop_id,
                    'product_id' => $product->id,
                    'quantity_change' => $receivedQty,
                    'new_stock_level' => $newStockLevel,
                    'reason' => 'purchase_arrived',
                    'reference_type' => PurchaseOrder::class,
                    'reference_id' => $po->id,
                    'note' => $note,
                ]);
            }

            $po->total_goods_cost = $newTotalGoodsCost;
            $po->grand_total = (($newTotalGoodsCost + $po->supplier_fee) * $po->exchange_rate) 
                               + $cargoFee + $localDeliFee + $adjustmentAmount;
            
            $po->paid_amount = $po->grand_total;
            $po->payment_status = 'paid';
            $po->status = 'arrived';
            $po->save();

            $po->logAction('arrived', [
                'adjustment_amount' => $adjustmentAmount,
                'adjustment_reason' => $adjustmentReason
            ]);

            return $po;
        });
    }

    /**
     * Cancel a Purchase Order.
     */
    public function cancelOrder(PurchaseOrder $po, string $reason = "Manual Cancellation"): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $reason) {
            if ($po->status !== 'pending') {
                throw new Exception("Only pending purchase orders can be cancelled.");
            }

            $po = PurchaseOrder::lockForUpdate()->findOrFail($po->id);
            $items = $po->items()->lockForUpdate()->get();

            foreach ($items as $item) {
                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                // Decrement pending stock
                $newPendingStock = max(0, $product->pending_stock - $item->quantity);
                
                if ($product->stock_quantity < 0) {
                    $deficit = abs($product->stock_quantity);
                    if ($newPendingStock < $deficit) {
                        throw new Exception("Cannot cancel PO because {$product->name} has pending sales orders that rely on this incoming stock. Cancel the relevant sales orders first.");
                    }
                }

                $product->update(['pending_stock' => $newPendingStock]);
            }

            $po->status = 'cancelled';
            $po->cancel_reason = $reason;
            $po->save();

            $po->logAction('cancelled', [
                'reason' => $reason
            ]);

            return $po;
        });
    }
}
