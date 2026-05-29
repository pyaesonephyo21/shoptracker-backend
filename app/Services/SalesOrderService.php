<?php

namespace App\Services;

use App\Models\InventoryLog;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SalesOrderService
{
    // --- 1. INITIAL CREATION (Fast & Simple) ---
    public function createOrder(array $data, array $items)
    {
        return DB::transaction(function () use ($data, $items) {
            $order = SalesOrder::create([
                'customer_name' => (string) ($data['customer_name'] ?? 'Guest'),
                'customer_phone' => (string) ($data['customer_phone'] ?? ''),
                'delivery_address' => (string) ($data['delivery_address'] ?? ''),
                'note' => (string) ($data['note'] ?? ''),
                'status' => 'pending',

                // Defaults
                'money_collected_by' => 'seller',
                'is_deli_prepaid' => false,
                'overcharge' => (float) ($data['overcharge'] ?? 0),
                'delivery_fee' => 0,
                'courier_service_fee' => 0,

                // Order Level Discount
                'discount_type' => (string) ($data['discount_type'] ?? 'none'),
                'discount_value' => (float) ($data['discount_value'] ?? 0),
                'discount_reason' => (string) ($data['discount_reason'] ?? ''),

                // Initial Payment
                'paid_amount' => (float) ($data['paid_amount'] ?? 0),

                // Audit
                'audit_log' => [['action' => 'created', 'by' => Auth::user()?->name ?? 'System', 'at' => now()->toIso8601String()]]
            ]);

            $isPreorder = false;

            foreach ($items as $item) {
                // Pass item-level discount data if available
                $wasPreorder = $this->processAddItem(
                    $order,
                    $item['product_id'],
                    $item['quantity'],
                    null, // No price override, use retail
                    $item // Pass full item array for discount logic
                );

                if ($wasPreorder) {
                    $isPreorder = true;
                }
            }

            if ($isPreorder) {
                $order->is_preorder = true;
                $order->save();
            }

            $this->recalculateTotals($order);

            return $order->load(['items.product']);
        });
    }

    // --- 2. EDITING & UPDATES ---

    public function updateOrder($id, array $data)
    {
        return DB::transaction(function () use ($id, $data) {
            $order = SalesOrder::findOrFail($id);

            // Update simple scalar fields
            $order->fill(collect($data)->only([
                'customer_name',
                'customer_phone',
                'delivery_address',
                'note',
                'tracking_number',
                'discount_reason',
                'discount_type',
                'courier_id'
            ])->toArray());

            // Handle numeric / financial fields
            if (isset($data['delivery_fee'])) $order->delivery_fee = (float) $data['delivery_fee'];
            if (isset($data['courier_service_fee'])) $order->courier_service_fee = (float) $data['courier_service_fee'];
            if (isset($data['discount_value'])) $order->discount_value = (float) $data['discount_value'];
            if (isset($data['overcharge'])) $order->overcharge = (float) $data['overcharge'];
            if (isset($data['paid_amount'])) $order->paid_amount = (float) $data['paid_amount'];

            // Calculate changes before saving
            $changes = [];
            foreach ($order->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at') continue;
                $changes[$key] = [
                    'old' => $order->getOriginal($key),
                    'new' => $newValue
                ];
            }

            // Always recalculate totals when editing to ensure consistency
            $this->recalculateTotals($order);

            // recalculated totals might add to getDirty()
            foreach ($order->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at' || isset($changes[$key])) continue;
                $changes[$key] = [
                    'old' => $order->getOriginal($key),
                    'new' => $newValue
                ];
            }

            if (!empty($changes)) {
                $order->logAction('updated', ['changes' => $changes]);
            } else {
                $order->save();
            }
            
            return $order;
        });
    }

    public function addItemToOrder($orderId, $productId, $quantity, $priceOverride = null)
    {
        return DB::transaction(function () use ($orderId, $productId, $quantity, $priceOverride) {
            $order = SalesOrder::findOrFail($orderId);

            if ($order->status !== 'pending') {
                throw new Exception("Cannot add items. Order is already {$order->status}.");
            }

            $this->processAddItem($order, $productId, $quantity, $priceOverride);
            $this->recalculateTotals($order);

            $order->logAction('item_added', ['product_id' => $productId, 'qty' => $quantity]);

            return $order->load('items.product');
        });
    }

    // --- 3. FULFILLMENT & SETTLEMENT ---

    public function fulfillOrder($id, array $data)
    {
        return DB::transaction(function () use ($id, $data) {
            $order = SalesOrder::findOrFail($id);

            $order->courier_id = $data['courier_id'] ?? $order->courier_id;
            $order->tracking_number = $data['tracking_number'] ?? $order->tracking_number;
            $order->delivery_note = $data['delivery_note'] ?? $order->delivery_note;

            if (isset($data['delivery_fee'])) $order->delivery_fee = (float) $data['delivery_fee'];
            if (isset($data['courier_service_fee'])) $order->courier_service_fee = (float) $data['courier_service_fee'];

            if (isset($data['is_deli_prepaid'])) $order->is_deli_prepaid = (bool) $data['is_deli_prepaid'];
            if (isset($data['money_collected_by'])) $order->money_collected_by = $data['money_collected_by'];

            $order->status = 'delivery_added';

            $this->recalculateTotals($order);
            $order->logAction('fulfillment_details_updated');

            return $order;
        });
    }

    public function markAsDelivered($id)
    {
        return DB::transaction(function () use ($id) {
            $order = SalesOrder::findOrFail($id);
            if ($order->status !== 'delivery_added') {
                throw new Exception("Order must have delivery arranged before it can be marked as delivered.");
            }

            $order->status = 'delivered';

            // If it's fully prepaid (deli prepaid and grand total paid), we might consider it complete, but user said prepaid ends at 'delivered'.
            // For now, just set to delivered.
            $order->save();

            $order->logAction('delivered');
            return $order;
        });
    }

    public function settle($id, $paymentMethod)
    {
        return DB::transaction(function () use ($id, $paymentMethod) {
            $order = SalesOrder::findOrFail($id);

            // Case 1: Courier Settlement
            if ($order->money_collected_by === 'courier') {
                if ($order->settlement_status === 'settled') {
                    throw new Exception("Order is already settled.");
                }

                $order->update([
                    'settlement_status' => 'settled',
                    'payment_status' => 'paid',
                    'payment_method' => $paymentMethod,
                    'paid_amount' => $order->customer_grand_total,
                    'status' => 'completed'
                ]);
            }
            // Case 2: Direct Customer Payment
            else {
                if ($order->payment_status === 'paid') {
                    throw new Exception("Order is already fully paid.");
                }
                $order->update([
                    'payment_status' => 'paid',
                    'paid_amount' => $order->customer_grand_total,
                    'status' => 'completed'
                ]);
            }

            $order->logAction('settled');
            return $order;
        });
    }

    // --- 4. CANCELLATION & RETURNS ---

    public function cancelOrder($id, $reason = "Manual Cancellation")
    {
        return DB::transaction(function () use ($id, $reason) {
            $order = SalesOrder::with('items')->findOrFail($id);
            if ($order->status === 'cancelled') throw new Exception("Order is already cancelled.");

            /** @var \App\Models\SalesOrderItem $item */
            foreach ($order->items as $item) {
                $product = Product::lockForUpdate()->find($item->product_id);
                if ($product) {
                    $product->increment('stock_quantity', $item->quantity);
                    $this->createLog($order, $product, $item->quantity, 'sale_cancelled_return');
                }
                $this->restoreBatches($item);
            }

            $order->status = 'cancelled';
            $order->cancel_reason = $reason;
            $order->logAction('cancelled', ['reason' => $reason]);
            $order->save();
            return $order;
        });
    }

    public function returnItem($orderId, $itemId, $quantity, $reason = "Customer Return")
    {
        return DB::transaction(function () use ($orderId, $itemId, $quantity, $reason) {
            $order = SalesOrder::findOrFail($orderId);
            $item = SalesOrderItem::where('sales_order_id', $orderId)->where('id', $itemId)->firstOrFail();

            if ($quantity > $item->quantity) {
                throw new Exception("Cannot return more than sold quantity.");
            }

            // 1. Restore Stock
            $product = Product::lockForUpdate()->find($item->product_id);
            if ($product) {
                $product->increment('stock_quantity', $quantity);

                // Log context: If pending, it's just removing. If completed, it's a return.
                $logType = ($order->status === 'pending') ? 'sale_item_removed' : 'sale_return_partial';
                $this->createLog($order, $product, $quantity, $logType);
            }

            $this->restoreBatches($item, $quantity);

            // 2. Adjust Item (Price reduction proportional to quantity)
            // Note: unit_price accounts for item-level discounts already.
            $refundLineTotal = $item->unit_price * $quantity;

            $item->quantity -= $quantity;
            $item->line_total -= $refundLineTotal;

            if ($item->quantity <= 0) {
                $item->delete();
            } else {
                $item->save();
            }

            // 3. Recalculate (This will drop Grand Total, likely causing 'overpaid' status)
            $this->recalculateTotals($order);

            $order->logAction('item_returned', [
                'product' => $product->name ?? 'Unknown',
                'qty' => $quantity,
                'reason' => $reason
            ]);

            return $order->load('items');
        });
    }

    // --- HELPERS ---

    private function processAddItem(SalesOrder $order, $productId, $qty, $priceOverride = null, $discountData = [])
    {
        $product = Product::lockForUpdate()->find($productId);

        if (!$product || ($product->stock_quantity + $product->pending_stock) < $qty) {
            throw new Exception("Stock limit exceeded for: {$product->name}");
        }

        $isPreorder = $qty > $product->stock_quantity;

        $product->decrement('stock_quantity', $qty);

        $discountType = $discountData['discount_type'] ?? 'none';
        $discountValue = (float) ($discountData['discount_value'] ?? 0);
        $discountReason = $discountData['discount_reason'] ?? null;

        // FIFO Batch Deduction Logic
        $remainingQtyNeeded = $qty;

        $activeBatches = \App\Models\ProductBatch::where('product_id', $product->id)
            ->where('shop_id', $order->shop_id)
            ->where('remaining_quantity', '>', 0)
            ->orderBy('created_at', 'asc')
            ->get();

        foreach ($activeBatches as $batch) {
            if ($remainingQtyNeeded <= 0) break;

            $takeQty = min($batch->remaining_quantity, $remainingQtyNeeded);
            $batchCost = $takeQty * $batch->unit_cost;

            $sellingPrice = $priceOverride !== null ? $priceOverride : ($batch->retail_price ?? $product->retail_price);

            $itemDiscountPerUnit = 0;
            if ($discountType === 'fixed') {
                $itemDiscountPerUnit = $discountValue;
            } elseif ($discountType === 'percent') {
                $itemDiscountPerUnit = $sellingPrice * ($discountValue / 100);
            }
            $itemDiscountPerUnit = min($itemDiscountPerUnit, $sellingPrice);

            $lineTotal = ($sellingPrice - $itemDiscountPerUnit) * $takeQty;
            $totalDiscountAmount = $itemDiscountPerUnit * $takeQty;

            $order->items()->create([
                'product_id' => $product->id,
                'quantity' => $takeQty,
                'unit_price' => $sellingPrice,
                'unit_cost'  => $batch->unit_cost,
                'line_total' => $lineTotal,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_amount' => $totalDiscountAmount,
                'discount_reason' => $discountReason,
                'batch_breakdown' => [['batch_id' => $batch->id, 'taken' => $takeQty, 'unit_cost' => (float)$batch->unit_cost, 'total_cost' => $batchCost]]
            ]);

            $remainingQtyNeeded -= $takeQty;
            $batch->decrement('remaining_quantity', $takeQty);
        }

        // Handle pre-orders using a "Virtual FIFO" across Pending POs
        if ($remainingQtyNeeded > 0) {
            $lastBatch = \App\Models\ProductBatch::where('product_id', $product->id)
                ->where('shop_id', $order->shop_id)
                ->latest('created_at')
                ->first();

            // Fetch all pending PO items for this product
            $pendingPoItems = \App\Models\PurchaseOrderItem::where('product_id', $product->id)
                ->whereHas('purchaseOrder', function ($q) use ($order) {
                    $q->where('shop_id', $order->shop_id)
                        ->where('status', 'pending');
                })
                ->orderBy('created_at', 'asc')
                ->get();

            // Calculate how many pending items were already spoken for (pre-ordered in past sales)
            $originalStock = $product->stock_quantity + $qty; // Stock before this sale decremented it
            $preorderedBeforeThisSale = $originalStock < 0 ? abs($originalStock) : 0;

            $skippedQty = 0;

            foreach ($pendingPoItems as $poItem) {
                if ($remainingQtyNeeded <= 0) break;

                $availableInThisPo = $poItem->quantity;

                // Skip items that belong to older pre-orders
                if ($skippedQty < $preorderedBeforeThisSale) {
                    $toSkipHere = min($availableInThisPo, $preorderedBeforeThisSale - $skippedQty);
                    $availableInThisPo -= $toSkipHere;
                    $skippedQty += $toSkipHere;
                }

                if ($availableInThisPo <= 0) continue;

                $takeQty = min($availableInThisPo, $remainingQtyNeeded);

                $fallbackCost = $poItem->unit_cost;
                $fallbackRetail = $poItem->retail_price ?? ($lastBatch ? $lastBatch->retail_price : $product->retail_price);

                $sellingPrice = $priceOverride !== null ? $priceOverride : $fallbackRetail;

                $itemDiscountPerUnit = 0;
                if ($discountType === 'fixed') {
                    $itemDiscountPerUnit = $discountValue;
                } elseif ($discountType === 'percent') {
                    $itemDiscountPerUnit = $sellingPrice * ($discountValue / 100);
                }
                $itemDiscountPerUnit = min($itemDiscountPerUnit, $sellingPrice);

                $lineTotal = ($sellingPrice - $itemDiscountPerUnit) * $takeQty;
                $totalDiscountAmount = $itemDiscountPerUnit * $takeQty;

                $fallbackTotalCost = $takeQty * $fallbackCost;

                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $takeQty,
                    'unit_price' => $sellingPrice,
                    'unit_cost'  => $fallbackCost,
                    'line_total' => $lineTotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $totalDiscountAmount,
                    'discount_reason' => $discountReason,
                    'batch_breakdown' => [['batch_id' => null, 'note' => 'Pre-order / Pending PO #' . $poItem->purchase_order_id, 'taken' => $takeQty, 'unit_cost' => (float)$fallbackCost, 'total_cost' => $fallbackTotalCost]]
                ]);

                $remainingQtyNeeded -= $takeQty;
            }

            // If they still oversold beyond all pending POs, fallback to base cost
            if ($remainingQtyNeeded > 0) {
                $fallbackCost = $lastBatch ? $lastBatch->unit_cost : $product->base_cost;
                $fallbackRetail = $lastBatch && $lastBatch->retail_price ? $lastBatch->retail_price : $product->retail_price;

                $sellingPrice = $priceOverride !== null ? $priceOverride : $fallbackRetail;

                $itemDiscountPerUnit = 0;
                if ($discountType === 'fixed') {
                    $itemDiscountPerUnit = $discountValue;
                } elseif ($discountType === 'percent') {
                    $itemDiscountPerUnit = $sellingPrice * ($discountValue / 100);
                }
                $itemDiscountPerUnit = min($itemDiscountPerUnit, $sellingPrice);

                $lineTotal = ($sellingPrice - $itemDiscountPerUnit) * $remainingQtyNeeded;
                $totalDiscountAmount = $itemDiscountPerUnit * $remainingQtyNeeded;
                $fallbackTotalCost = $remainingQtyNeeded * $fallbackCost;

                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $remainingQtyNeeded,
                    'unit_price' => $sellingPrice,
                    'unit_cost'  => $fallbackCost,
                    'line_total' => $lineTotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $totalDiscountAmount,
                    'discount_reason' => $discountReason,
                    'batch_breakdown' => [['batch_id' => null, 'note' => 'Pre-order / Missing Batch', 'taken' => $remainingQtyNeeded, 'unit_cost' => (float)$fallbackCost, 'total_cost' => $fallbackTotalCost]]
                ]);
            }
        }

        $this->createLog($order, $product, $qty, 'sale_sold');

        return $isPreorder;
    }

    private function calculateItemSubtotals(SalesOrder $order)
    {
        $subtotal = $order->items()->sum('line_total');
        $totalCost = $order->items->sum(function ($item) {
            return $item->quantity * $item->unit_cost;
        });
        return [$subtotal, $totalCost];
    }

    private function calculateOrderDiscount(SalesOrder $order, $subtotal)
    {
        $discountAmount = 0;
        if ($order->discount_type === 'fixed') $discountAmount = $order->discount_value;
        elseif ($order->discount_type === 'percent') $discountAmount = $subtotal * ($order->discount_value / 100);
        return min($discountAmount, $subtotal);
    }

    private function calculateLogistics(SalesOrder $order, $afterDiscount)
    {
        $customerGrandTotal = 0;
        $netRevenue = 0;

        if ($order->money_collected_by === 'courier') {
            $customerGrandTotal = $afterDiscount + $order->delivery_fee + $order->overcharge;
            $netRevenue = $afterDiscount + $order->overcharge - $order->courier_service_fee;
            $order->settlement_status = 'unpaid';
        } elseif ($order->is_deli_prepaid) {
            $customerGrandTotal = $afterDiscount + $order->delivery_fee + $order->overcharge;
            $netRevenue = $afterDiscount + $order->overcharge + $order->delivery_fee - $order->courier_service_fee;
        } else {
            $customerGrandTotal = $afterDiscount + $order->overcharge;
            $netRevenue = $afterDiscount + $order->overcharge - $order->courier_service_fee;
        }

        return [$customerGrandTotal, $netRevenue];
    }

    private function determinePaymentStatus(SalesOrder $order, $customerGrandTotal)
    {
        if ($order->paid_amount >= $customerGrandTotal) {
            return 'paid';
        } elseif ($order->paid_amount > 0) {
            return 'partial';
        } else {
            return 'unpaid';
        }
    }

    private function recalculateTotals(SalesOrder $order)
    {
        [$subtotal, $totalCost] = $this->calculateItemSubtotals($order);

        $discountAmount = $this->calculateOrderDiscount($order, $subtotal);
        $afterDiscount = $subtotal - $discountAmount;

        [$customerGrandTotal, $netRevenue] = $this->calculateLogistics($order, $afterDiscount);

        $order->payment_status = $this->determinePaymentStatus($order, $customerGrandTotal);

        $order->subtotal = $subtotal;
        $order->total_cost = $totalCost;
        $order->discount_total = $discountAmount;
        $order->customer_grand_total = $customerGrandTotal;
        $order->net_revenue = $netRevenue;
        $order->net_profit = $netRevenue - $totalCost - $order->return_cost;
        $order->save();
    }

    private function createLog($order, $product, $qty, $reason)
    {
        $change = ($reason === 'sale_sold') ? -abs($qty) : abs($qty);
        InventoryLog::create([
            'shop_id' => $order->shop_id,
            'product_id' => $product->id,
            'quantity_change' => $change,
            'new_stock_level' => $product->stock_quantity,
            'reason' => $reason,
            'reference_type' => SalesOrder::class,
            'reference_id' => $order->id,
            'note' => "Order #{$order->id}"
        ]);
    }

    private function restoreBatches(SalesOrderItem $item, $returnQty = null)
    {
        $breakdown = $item->batch_breakdown;
        if (!is_array($breakdown) || empty($breakdown)) return;

        $qtyToRestore = $returnQty ?? $item->quantity;

        // Reverse order so we put back into the newest batches first (LIFO restore)
        for ($i = count($breakdown) - 1; $i >= 0; $i--) {
            if ($qtyToRestore <= 0) break;

            $b = &$breakdown[$i];

            if ($b['batch_id'] === null) {
                $restoreAmount = min($b['taken'], $qtyToRestore);
                $b['taken'] -= $restoreAmount;
                $qtyToRestore -= $restoreAmount;
                continue;
            }

            $batch = \App\Models\ProductBatch::find($b['batch_id']);
            if ($batch) {
                $restoreAmount = min($b['taken'], $qtyToRestore);
                $batch->increment('remaining_quantity', $restoreAmount);
                $b['taken'] -= $restoreAmount;
                $qtyToRestore -= $restoreAmount;
            }
        }

        $item->batch_breakdown = $breakdown;
    }
}
