<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\InventoryLog;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Exception;
use Illuminate\Support\Facades\DB;

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
                    'Initial Prepayment for PO '.$po->batch_name,
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
                'supplier_id' => $data['supplier_id'],
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
                throw new Exception('Only pending purchase orders can be edited.');
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
                if (! isset($stockChanges[$oldItem->product_variant_id])) {
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

                if (! isset($stockChanges[$item['product_variant_id']])) {
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
                'Payment for PO '.$po->batch_name,
                PurchaseOrder::class,
                $po->id
            );

            $changes = [];
            foreach ($po->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at') {
                    continue;
                }

                $oldValue = $po->getOriginal($key);
                // loose comparison to ignore "0" vs 0, and null vs ""
                if ($oldValue != $newValue && ! (empty($oldValue) && empty($newValue))) {
                    $changes[$key] = [
                        'old' => $oldValue,
                        'new' => $newValue,
                    ];
                }
            }

            // For PO edits, we always rebuild items, so we'll just indicate items were updated.
            $changes['items'] = [
                'old' => '...',
                'new' => 'updated',
            ];

            $po->logAction('updated', ['changes' => $changes]);
            $po->saveQuietly(); // saveQuietly because logAction already saves if it exists, but logAction does saveQuietly anyway

            return $po;
        });
    }

    /**
     * Mark a PO shipment as arrived (supports partial arrivals and product-level cargo fees).
     */
    public function markAsArrived(PurchaseOrder $po, array $arrivalData): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $arrivalData) {
            if ($po->status === 'arrived') {
                throw new Exception('This purchase order has already been fully received.');
            }
            if ($po->status === 'cancelled') {
                throw new Exception('Cannot receive shipments for a cancelled purchase order.');
            }

            // Lock PO and items
            $po = PurchaseOrder::lockForUpdate()->findOrFail($po->id);
            $items = $po->items()->lockForUpdate()->get();

            $totalPoOrderedQty = $items->sum('quantity') ?: 1;

            $shipmentLocalDeliFee = (float) ($arrivalData['local_deli_fee'] ?? 0);
            $shipmentAdjustmentAmount = (float) ($arrivalData['adjustment_amount'] ?? 0);
            $shipmentAdjustmentReason = $arrivalData['adjustment_reason'] ?? null;

            $receivedItemsMap = collect($arrivalData['received_items'] ?? [])->keyBy('id');
            $totalShipmentQuantity = 0;
            $totalShipmentCargoFee = 0;

            // Shared foreign cost rates per ordered unit
            $foreignDeliPerUnit = ($po->foreign_deli_fee * $po->exchange_rate) / $totalPoOrderedQty;
            $supplierFeePerUnit = ($po->supplier_fee * $po->exchange_rate) / $totalPoOrderedQty;
            $discountPerUnit = ($po->total_discount * $po->exchange_rate) / $totalPoOrderedQty;

            foreach ($items as $item) {
                $itemData = $receivedItemsMap->get($item->id);
                if (! $itemData) {
                    continue;
                }

                $shipmentQty = (int) ($itemData['received_quantity'] ?? 0);
                if ($shipmentQty <= 0) {
                    continue;
                }

                $rowCargoFee = (float) ($itemData['allocated_cargo_fee'] ?? 0);
                $rowAdjustment = (float) ($itemData['allocated_adjustment_amount'] ?? 0);
                $retailPrice = isset($itemData['retail_price']) && $itemData['retail_price'] !== '' && $itemData['retail_price'] !== null
                    ? (float) $itemData['retail_price']
                    : null;

                $totalShipmentQuantity += $shipmentQty;
                $totalShipmentCargoFee += $rowCargoFee;

                // Landed unit cost for this specific shipment batch
                $baseUnitCostMmk = $item->original_cost * $po->exchange_rate;
                $cargoPerUnit = $rowCargoFee / $shipmentQty;
                $adjPerUnit = $rowAdjustment / $shipmentQty;

                $finalUnitCostMmk = $baseUnitCostMmk + $foreignDeliPerUnit + $supplierFeePerUnit - $discountPerUnit + $cargoPerUnit + $adjPerUnit;

                // Lock Variant and handle deficit for pre-ordered items
                $variant = ProductVariant::withTrashed()->lockForUpdate()->findOrFail($item->product_variant_id);
                $currentStock = $variant->stock_quantity;
                $batchRemainingQty = $shipmentQty;

                if ($currentStock < 0) {
                    $deficit = abs($currentStock);
                    $deduction = min($deficit, $shipmentQty);
                    $batchRemainingQty = $shipmentQty - $deduction;
                }

                // Create ProductBatch for this received slice
                ProductBatch::create([
                    'shop_id' => $po->shop_id,
                    'product_variant_id' => $variant->id,
                    'reference_type' => PurchaseOrder::class,
                    'reference_id' => $po->id,
                    'initial_quantity' => $shipmentQty,
                    'remaining_quantity' => $batchRemainingQty,
                    'unit_cost' => $finalUnitCostMmk,
                    'retail_price' => $retailPrice,
                ]);

                // Update product stock and decrement pending stock by the received quantity
                $newStockLevel = $variant->stock_quantity + $shipmentQty;
                $newPendingStock = max(0, $variant->pending_stock - $shipmentQty);

                $updateData = [
                    'stock_quantity' => $newStockLevel,
                    'pending_stock' => $newPendingStock,
                ];
                if ($retailPrice !== null) {
                    $updateData['retail_price'] = $retailPrice;
                }
                $variant->update($updateData);

                // Update item cumulative received quantity and allocations
                $item->received_quantity = ($item->received_quantity ?? 0) + $shipmentQty;
                $item->allocated_cargo_fee = ($item->allocated_cargo_fee ?? 0) + $rowCargoFee;
                $item->allocated_adjustment_amount = ($item->allocated_adjustment_amount ?? 0) + $rowAdjustment;
                $item->line_total = $item->received_quantity * $item->unit_cost;
                $item->save();

                // Create Inventory Log
                InventoryLog::create([
                    'shop_id' => $po->shop_id,
                    'product_variant_id' => $variant->id,
                    'quantity_change' => $shipmentQty,
                    'new_stock_level' => $newStockLevel,
                    'reason' => 'purchase_arrived',
                    'reference_type' => PurchaseOrder::class,
                    'reference_id' => $po->id,
                    'note' => "PO Shipment Arrived: {$po->batch_name} (+{$shipmentQty} pcs)",
                ]);
            }

            if ($totalShipmentQuantity === 0) {
                throw new Exception('Please enter a receiving quantity of at least 1 for the items arriving in this shipment.');
            }

            $effectiveShipmentCargo = max($totalShipmentCargoFee, (float) ($arrivalData['cargo_fee'] ?? 0));

            // Accumulate shipment costs into PO cumulative totals
            $po->cargo_fee = ($po->cargo_fee ?? 0) + $effectiveShipmentCargo;
            $po->local_deli_fee = ($po->local_deli_fee ?? 0) + $shipmentLocalDeliFee;
            $po->adjustment_amount = ($po->adjustment_amount ?? 0) + $shipmentAdjustmentAmount;
            if ($shipmentAdjustmentReason) {
                $po->adjustment_reason = $shipmentAdjustmentReason;
            }

            // Recalculate Grand Total
            $baseGoodsAndForeign = ($po->total_goods_cost + $po->foreign_deli_fee + $po->supplier_fee - $po->total_discount) * $po->exchange_rate;
            $po->grand_total = $baseGoodsAndForeign + $po->cargo_fee + $po->local_deli_fee + $po->adjustment_amount;

            // Re-fetch items to verify completion status
            $freshItems = $po->items()->get();
            $allFullyReceived = $freshItems->every(function ($it) {
                return ($it->received_quantity ?? 0) >= $it->quantity;
            });

            if ($allFullyReceived) {
                $po->status = 'arrived';
                $po->payment_status = 'paid';
                $po->paid_amount = $po->grand_total;
            } else {
                $po->status = 'partially_arrived';
            }
            $po->save();

            // Finance Cash Outflow for this shipment
            $shipmentOutflow = $effectiveShipmentCargo + $shipmentLocalDeliFee + $shipmentAdjustmentAmount;
            if ($shipmentOutflow > 0) {
                $shipmentLabel = $allFullyReceived ? 'Final Shipment' : 'Partial Shipment';
                app(CashFlowService::class)->recordOutflow(
                    $po->shop_id,
                    $shipmentOutflow,
                    'purchase',
                    "{$shipmentLabel} Cargo & Delivery Fee for PO {$po->batch_name}",
                    PurchaseOrder::class,
                    $po->id
                );
                $po->paid_amount += $shipmentOutflow;
                $po->save();
            }

            $po->logAction($allFullyReceived ? 'arrived' : 'partially_arrived', [
                'received_qty_now' => $totalShipmentQuantity,
                'cargo_fee_now' => $effectiveShipmentCargo,
                'local_deli_now' => $shipmentLocalDeliFee,
            ]);

            return $po;
        });
    }

    /**
     * Cancel a Purchase Order.
     */
    public function cancelOrder(PurchaseOrder $po, string $reason = 'Manual Cancellation', $refundAmount = null): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $reason, $refundAmount) {
            if ($po->status !== 'pending') {
                throw new Exception('Only pending purchase orders can be cancelled.');
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
                app(CashFlowService::class)->recordInflow(
                    $po->shop_id,
                    $refundToReceive,
                    'refund',
                    'Refund for Cancelled Purchase Order #'.$po->id,
                    PurchaseOrder::class,
                    $po->id
                );
            }
            if ($lossAmount > 0) {
                Expense::create([
                    'shop_id' => $po->shop_id,
                    'title' => 'Sunk Cost on PO Cancellation (Order #'.$po->id.')',
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
                'reason' => $reason,
            ]);

            return $po;
        });
    }
}
