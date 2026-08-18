<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Product;
use App\Models\InventoryLog;
use App\Models\ProductVariant;
use App\Models\ProductBatch;
use Illuminate\Support\Facades\DB;
use Exception;
use App\Services\CashFlowService;

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
            
            $orderType = $data['order_type'] ?? 'global';
            $foreignDeliFee = (float) ($data['foreign_deli_fee'] ?? 0);
            $totalDiscount = (float) ($data['total_discount'] ?? 0);
            $supplierFeePercentage = (float) ($data['supplier_fee_percentage'] ?? 0);
            
            // Calculate Supplier Fee
            $supplierFee = 0;
            if ($supplierFeePercentage > 0) {
                $supplierFee = ($totalGoodsCost + $foreignDeliFee - $totalDiscount) * ($supplierFeePercentage / 100);
            }
            
            // Grand Total (in MMK)
            // Foreign costs = Goods + Foreign Deli + Supplier Fee - Discount
            $grandTotal = ($totalGoodsCost + $foreignDeliFee + $supplierFee - $totalDiscount) * $exchangeRate;
            
            // Payment Status
            $paidAmount = (float) ($data['paid_amount'] ?? 0);
            $paymentStatus = 'unpaid';
            if ($paidAmount > 0) {
                $paymentStatus = $paidAmount >= $grandTotal ? 'paid' : 'partial';
            }

            // Create the main PO
            $po = PurchaseOrder::create([
                'batch_name' => $data['batch_name'],
                'supplier_id' => $data['supplier_id'] ?: null,
                'local_shop_name' => $data['shop_name'] ?: null,
                'order_type' => $orderType,
                'status' => 'pending',
                'exchange_rate' => $exchangeRate,
                'total_goods_cost' => $totalGoodsCost,
                'foreign_deli_fee' => $foreignDeliFee,
                'total_discount' => $totalDiscount,
                'supplier_fee_percentage' => $supplierFeePercentage,
                'supplier_fee' => $supplierFee,
                'cargo_fee' => 0,
                'local_deli_fee' => 0,
                'grand_total' => $grandTotal,
                'payment_status' => $paymentStatus,
                'paid_amount' => $paidAmount,
                'note' => $data['note'] ?? null,
            ]);

            if ($paidAmount > 0) {
                app(CashFlowService::class)->recordOutflow(
                    $po->shop_id,
                    $paidAmount,
                    'purchase',
                    'Initial Prepayment for PO ' . $po->batch_name,
                    PurchaseOrder::class,
                    $po->id
                );
            }

            // Create the items
            foreach ($data['items'] as $item) {
                $originalCost = $item['unit_cost'];
                $unitCostMmk = $originalCost * $exchangeRate;
                $lineTotalMmk = $item['quantity'] * $unitCostMmk;

                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'product_variant_id' => $item['product_variant_id'],
                    'quantity' => $item['quantity'],
                    'original_cost' => $originalCost,
                    'unit_cost' => $unitCostMmk,
                    'line_total' => $lineTotalMmk,
                    'retail_price' => $item['retail_price'] ?? null,
                ]);

                // Increment pending_stock for the variant
                $variant = ProductVariant::withTrashed()->lockForUpdate()->findOrFail($item['product_variant_id']);
                $variant->increment('pending_stock', $item['quantity']);
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
            
            $orderType = $data['order_type'] ?? 'global';
            $foreignDeliFee = (float) ($data['foreign_deli_fee'] ?? 0);
            $totalDiscount = (float) ($data['total_discount'] ?? 0);
            $supplierFeePercentage = (float) ($data['supplier_fee_percentage'] ?? 0);
            
            // Calculate Supplier Fee
            $supplierFee = 0;
            if ($supplierFeePercentage > 0) {
                $supplierFee = ($totalGoodsCost + $foreignDeliFee - $totalDiscount) * ($supplierFeePercentage / 100);
            }
            
            // Grand Total (in MMK)
            // Foreign costs = Goods + Foreign Deli + Supplier Fee - Discount
            $grandTotal = ($totalGoodsCost + $foreignDeliFee + $supplierFee - $totalDiscount) * $exchangeRate;
            
            // Payment Status
            $paidAmount = (float) ($data['paid_amount'] ?? 0);
            $paymentStatus = 'unpaid';
            if ($paidAmount > 0) {
                $paymentStatus = $paidAmount >= $grandTotal ? 'paid' : 'partial';
            }

            // Track stock changes to validate deficit later
            $stockChanges = [];

            // 1. Revert old items
            $oldItems = $po->items()->get();
            foreach ($oldItems as $oldItem) {
                if (!isset($stockChanges[$oldItem->product_variant_id])) {
                    $stockChanges[$oldItem->product_variant_id] = 0;
                }
                $stockChanges[$oldItem->product_variant_id] -= $oldItem->quantity;
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
                    'product_variant_id' => $item['product_variant_id'],
                    'quantity' => $item['quantity'],
                    'original_cost' => $originalCost,
                    'unit_cost' => $unitCostMmk,
                    'line_total' => $lineTotalMmk,
                    'retail_price' => $item['retail_price'] ?? null,
                ]);

                if (!isset($stockChanges[$item['product_variant_id']])) {
                    $stockChanges[$item['product_variant_id']] = 0;
                }
                $stockChanges[$item['product_variant_id']] += $item['quantity'];
            }

            // 3. Apply stock changes to Products and validate deficit
            foreach ($stockChanges as $variantId => $change) {
                if ($change !== 0) {
                    $variant = ProductVariant::with('product')->withTrashed()->lockForUpdate()->findOrFail($variantId);
                    $newPendingStock = max(0, $variant->pending_stock + $change);

                    if ($variant->stock_quantity < 0) {
                        $deficit = abs($variant->stock_quantity);
                        if ($newPendingStock < $deficit) {
                            $productName = $variant->product ? $variant->product->name : 'Product';
                            throw new Exception("Cannot update PO because {$productName} ({$variant->sku}) has pending sales orders that rely on this incoming stock. The new quantity is insufficient.");
                        }
                    }

                    $variant->update(['pending_stock' => $newPendingStock]);
                }
            }

            // Update PO
            $po->fill([
                'batch_name' => $data['batch_name'],
                'supplier_id' => $data['supplier_id'] ?: null,
                'local_shop_name' => $data['shop_name'] ?: null,
                'order_type' => $orderType,
                'exchange_rate' => $exchangeRate,
                'total_goods_cost' => $totalGoodsCost,
                'foreign_deli_fee' => $foreignDeliFee,
                'total_discount' => $totalDiscount,
                'supplier_fee_percentage' => $supplierFeePercentage,
                'supplier_fee' => $supplierFee,
                'grand_total' => $grandTotal,
                'payment_status' => $paymentStatus,
                'paid_amount' => $paidAmount,
                'note' => $data['note'] ?? null,
            ]);

            app(CashFlowService::class)->syncOutflow(
                $po->shop_id,
                $paidAmount,
                'purchase',
                'Payment for PO ' . $po->batch_name,
                PurchaseOrder::class,
                $po->id
            );

            $changes = [];
            foreach ($po->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at') continue;
                
                $oldValue = $po->getOriginal($key);
                // loose comparison to ignore "0" vs 0, and null vs ""
                if ($oldValue != $newValue && !(empty($oldValue) && empty($newValue))) {
                    $changes[$key] = [
                        'old' => $oldValue,
                        'new' => $newValue
                    ];
                }
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
            $previousPaidAmount = (float) $po->paid_amount;
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
            
            $foreignDeliFeeMmk = $po->foreign_deli_fee * $po->exchange_rate;
            $supplierFeeMmk = $po->supplier_fee * $po->exchange_rate;

            foreach ($items as $item) {
                $receivedQty = $item->received_quantity;
                $item->save(); // Save updated received_quantity and line_total

                $variant = ProductVariant::withTrashed()->lockForUpdate()->findOrFail($item->product_variant_id);
                
                $finalUnitCostMmk = $item->unit_cost;

                $retailPrice = $receivedItemsMap->has($item->id) && isset($receivedItemsMap->get($item->id)['retail_price'])
                    ? $receivedItemsMap->get($item->id)['retail_price']
                    : null;

                // Calculate deficit (pre-ordered items)
                $currentStock = $variant->stock_quantity;
                $batchRemainingQty = $receivedQty;

                if ($currentStock < 0) {
                    $deficit = abs($currentStock);
                    $deduction = min($deficit, $receivedQty);
                    $batchRemainingQty = $receivedQty - $deduction;
                }

                // --- FULLY LANDED COST CALCULATION ---
                $finalUnitCostMmk = $item->unit_cost; // This is (original_cost * exchange_rate)
                
                if ($receivedQty > 0) {
                    // 1. Calculate Quantity Fraction for this row
                    $quantityFraction = $totalReceivedQuantity > 0 ? ($receivedQty / $totalReceivedQuantity) : 0;
                    
                    // 2. Distribute Foreign Costs and Discounts (allocated to the entire row)
                    $rowForeignDeliMmk = $foreignDeliFeeMmk * $quantityFraction;
                    $rowSupplierFeeMmk = $supplierFeeMmk * $quantityFraction;
                    $rowTotalDiscountMmk = ($po->total_discount * $po->exchange_rate) * $quantityFraction;
                    
                    // 3. Get Cargo and Adjustments from frontend overrides (or 0)
                    $rowCargoFee = 0;
                    $rowAdjustment = 0;
                    if ($receivedItemsMap->has($item->id)) {
                        $rowCargoFee = (float) ($receivedItemsMap->get($item->id)['allocated_cargo_fee'] ?? 0);
                        $rowAdjustment = (float) ($receivedItemsMap->get($item->id)['allocated_adjustment_amount'] ?? 0);
                    }
                    
                    // 4. Calculate per-unit allocations
                    $unitForeignDeli = $rowForeignDeliMmk / $receivedQty;
                    $unitSupplierFee = $rowSupplierFeeMmk / $receivedQty;
                    $unitTotalDiscount = $rowTotalDiscountMmk / $receivedQty;
                    $unitCargoFee = $rowCargoFee / $receivedQty;
                    $unitAdjustment = $rowAdjustment / $receivedQty;
                    
                    // 5. Sum it all up into the final unit cost (subtracting discount)
                    $finalUnitCostMmk = $item->unit_cost + $unitForeignDeli + $unitSupplierFee - $unitTotalDiscount + $unitCargoFee + $unitAdjustment;

                    // Save allocations to the item
                    $item->allocated_cargo_fee = $rowCargoFee;
                    $item->allocated_adjustment_amount = $rowAdjustment;
                    $item->save();

                    // Create ProductBatch
                    ProductBatch::create([
                        'shop_id' => $po->shop_id,
                        'product_variant_id' => $variant->id,
                        'reference_type' => PurchaseOrder::class,
                        'reference_id' => $po->id,
                        'initial_quantity' => $receivedQty,
                        'remaining_quantity' => $batchRemainingQty,
                        'unit_cost' => $finalUnitCostMmk,
                        'retail_price' => $retailPrice,
                    ]);
                }

                // Update product stock (only received items), decrement pending stock (by original ordered quantity)
                $newStockLevel = $variant->stock_quantity + $receivedQty;
                $newPendingStock = max(0, $variant->pending_stock - $item->quantity);
                
                $updateData = [
                    'stock_quantity' => $newStockLevel,
                    'pending_stock' => $newPendingStock,
                ];

                if ($retailPrice !== null && $retailPrice !== '') {
                    $updateData['retail_price'] = $retailPrice;
                }

                $variant->update($updateData);

                // Create Inventory Log
                $note = "PO Arrived: {$po->batch_name}";
                if ($receivedQty !== $item->quantity) {
                    $note .= " (Ordered: {$item->quantity}, Received: {$receivedQty})";
                }
                
                InventoryLog::create([
                    'shop_id' => $po->shop_id,
                    'product_variant_id' => $variant->id,
                    'quantity_change' => $receivedQty,
                    'new_stock_level' => $newStockLevel,
                    'reason' => 'purchase_arrived',
                    'reference_type' => PurchaseOrder::class,
                    'reference_id' => $po->id,
                    'note' => $note,
                ]);
            }

            $po->total_goods_cost = $newTotalGoodsCost;
            $po->grand_total = (($newTotalGoodsCost + $po->foreign_deli_fee + $po->supplier_fee - $po->total_discount) * $po->exchange_rate) 
                               + $cargoFee + $localDeliFee + $adjustmentAmount;
            
            $po->paid_amount = $po->grand_total;
            $po->payment_status = 'paid';
            $po->status = 'arrived';
            $po->save();

            $additionalPayment = $po->paid_amount - $previousPaidAmount;

            if ($additionalPayment > 0) {
                app(CashFlowService::class)->recordOutflow(
                    $po->shop_id,
                    $additionalPayment,
                    'purchase',
                    'Arrival Settlement & Cargo Fee for PO ' . $po->batch_name,
                    PurchaseOrder::class,
                    $po->id
                );
            } elseif ($additionalPayment < 0) {
                app(CashFlowService::class)->recordInflow(
                    $po->shop_id,
                    abs($additionalPayment),
                    'refund',
                    'Refund / Shortfall Settlement for PO ' . $po->batch_name,
                    PurchaseOrder::class,
                    $po->id
                );
            }

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
    public function cancelOrder(PurchaseOrder $po, string $reason = "Manual Cancellation", $refundAmount = null): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $reason, $refundAmount) {
            if ($po->status !== 'pending') {
                throw new Exception("Only pending purchase orders can be cancelled.");
            }

            $po = PurchaseOrder::lockForUpdate()->findOrFail($po->id);
            $items = $po->items()->lockForUpdate()->get();

            foreach ($items as $item) {
                $variant = ProductVariant::with('product')->withTrashed()->lockForUpdate()->findOrFail($item->product_variant_id);
                // Decrement pending stock
                $newPendingStock = max(0, $variant->pending_stock - $item->quantity);
                
                if ($variant->stock_quantity < 0) {
                    $deficit = abs($variant->stock_quantity);
                    if ($newPendingStock < $deficit) {
                        $productName = $variant->product ? $variant->product->name : 'Product';
                        throw new Exception("Cannot cancel PO because {$productName} ({$variant->sku}) has pending sales orders that rely on this incoming stock. Cancel the relevant sales orders first.");
                    }
                }

                $variant->update(['pending_stock' => $newPendingStock]);
            }
            
            $refundToReceive = $refundAmount ?? $po->paid_amount;
            $lossAmount = $po->paid_amount - $refundToReceive;
            
            if ($refundToReceive > 0) {
                app(\App\Services\CashFlowService::class)->recordInflow(
                    $po->shop_id,
                    $refundToReceive,
                    'refund',
                    'Refund for Cancelled Purchase Order #' . $po->id,
                    PurchaseOrder::class,
                    $po->id
                );
            }
            if ($lossAmount > 0) {
                \App\Models\Expense::create([
                    'shop_id' => $po->shop_id,
                    'title' => 'Sunk Cost on PO Cancellation (Order #' . $po->id . ')',
                    'amount' => $lossAmount,
                    'incurred_at' => now(),
                    'category' => 'PO Sunk Cost',
                    'note' => 'Loss from un-refunded PO payment.',
                ]);
            }

            $po->status = 'cancelled';
            $po->cancel_reason = $reason;
            $po->paid_amount = 0;
            $po->save();

            $po->logAction('cancelled', [
                'reason' => $reason
            ]);

            return $po;
        });
    }
}
