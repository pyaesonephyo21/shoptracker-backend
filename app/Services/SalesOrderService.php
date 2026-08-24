<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\InventoryLog;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use Exception;
use Illuminate\Support\Facades\DB;

class SalesOrderService
{
    // --- 1. INITIAL CREATION (Fast & Simple) ---
    public function createOrder(array $data, array $items)
    {
        return DB::transaction(function () use ($data, $items) {
            $hasCourier = ! empty($data['courier_id']);
            $order = SalesOrder::create([
                'customer_name' => (string) ($data['customer_name'] ?? 'Guest'),
                'customer_phone' => (string) ($data['customer_phone'] ?? ''),
                'delivery_address' => (string) ($data['delivery_address'] ?? ''),
                'note' => (string) ($data['note'] ?? ''),
                'delivery_note' => (string) ($data['delivery_note'] ?? ''),
                'status' => $hasCourier ? 'delivery_added' : 'pending',

                // Logistics
                'courier_id' => $data['courier_id'] ?? null,
                'tracking_number' => $data['tracking_number'] ?? null,
                'money_collected_by' => $data['money_collected_by'] ?? 'seller',
                'is_deli_prepaid' => (bool) ($data['is_deli_prepaid'] ?? false),
                'overcharge' => (float) ($data['overcharge'] ?? 0),
                'extra_fee' => (float) ($data['extra_fee'] ?? 0),
                'delivery_fee' => (float) ($data['delivery_fee'] ?? 0),
                'courier_service_fee' => (float) ($data['courier_service_fee'] ?? 0),

                // Order Level Discount
                'discount_type' => (string) ($data['discount_type'] ?? 'none'),
                'discount_value' => (float) ($data['discount_value'] ?? 0),
                'discount_reason' => (string) ($data['discount_reason'] ?? ''),

                // Initial Payment
                'paid_amount' => (float) ($data['paid_amount'] ?? 0),
            ]);

            $isPreorder = false;

            foreach ($items as $item) {
                // Pass item-level discount data if available
                $wasPreorder = $this->processAddItem(
                    $order,
                    $item['product_variant_id'],
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

            if ($order->paid_amount > 0) {
                $order->payments()->create([
                    'amount' => $order->paid_amount,
                    'payment_method' => $data['payment_method'] ?? 'cash',
                ]);

                app(CashFlowService::class)->recordInflow(
                    $order->shop_id,
                    $order->paid_amount,
                    'sale',
                    'Initial payment for Order #'.$order->id,
                    SalesOrder::class,
                    $order->id
                );
            }

            // Upfront Courier Fee Payout if created with prepaid delivery
            if ($order->courier_id && $order->money_collected_by === 'seller' && $order->is_deli_prepaid) {
                $feeToPay = $order->customer_grand_total - $order->net_revenue;

                if ($feeToPay > 0 && $order->settlement_status !== 'settled' && $order->paid_amount >= $order->customer_grand_total) {
                    app(CashFlowService::class)->recordOutflow(
                        $order->shop_id,
                        $feeToPay,
                        'expense',
                        'Upfront Courier fee payout for Order #'.$order->id,
                        SalesOrder::class,
                        $order->id
                    );

                    $order->settlement_status = 'settled';
                    $order->save();
                }
            }

            $order->logAction('created');

            return $order->load(['items.productVariant.product', 'payments']);
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
                'delivery_note',
                'tracking_number',
                'discount_reason',
                'discount_type',
                'courier_id',
                'money_collected_by',
            ])->toArray());

            // Handle numeric / financial fields
            if (isset($data['delivery_fee'])) {
                $order->delivery_fee = (float) $data['delivery_fee'];
            }
            if (isset($data['courier_service_fee'])) {
                $order->courier_service_fee = (float) $data['courier_service_fee'];
            }
            if (isset($data['discount_value'])) {
                $order->discount_value = (float) $data['discount_value'];
            }
            if (isset($data['overcharge'])) {
                $order->overcharge = (float) $data['overcharge'];
            }
            if (isset($data['extra_fee'])) {
                $order->extra_fee = (float) $data['extra_fee'];
            }
            if (isset($data['is_deli_prepaid'])) {
                $order->is_deli_prepaid = (bool) $data['is_deli_prepaid'];
            }

            $oldPaidAmount = $order->paid_amount;
            if (isset($data['paid_amount'])) {
                $order->paid_amount = (float) $data['paid_amount'];
            }
            $paidAmountDiff = $order->paid_amount - $oldPaidAmount;

            if ($paidAmountDiff != 0) {
                $order->payments()->create([
                    'amount' => $paidAmountDiff,
                    'payment_method' => 'correction',
                ]);

                if ($paidAmountDiff > 0) {
                    app(CashFlowService::class)->recordInflow(
                        $order->shop_id,
                        $paidAmountDiff,
                        'sale',
                        'Payment adjustment for Order #'.$order->id,
                        SalesOrder::class,
                        $order->id
                    );
                } else {
                    app(CashFlowService::class)->recordOutflow(
                        $order->shop_id,
                        abs($paidAmountDiff),
                        'refund',
                        'Payment reduction adjustment for Order #'.$order->id,
                        SalesOrder::class,
                        $order->id
                    );
                }
            }

            // Calculate changes before saving
            $changes = [];
            foreach ($order->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at') {
                    continue;
                }

                $oldValue = $order->getOriginal($key);
                // loose comparison to ignore "0" vs 0, and null vs ""
                if ($oldValue != $newValue && ! (empty($oldValue) && empty($newValue))) {
                    $changes[$key] = [
                        'old' => $oldValue,
                        'new' => $newValue,
                    ];
                }
            }

            // Always recalculate totals when editing to ensure consistency
            $this->recalculateTotals($order);

            // recalculated totals might add to getDirty()
            foreach ($order->getDirty() as $key => $newValue) {
                if ($key === 'audit_log' || $key === 'updated_at' || isset($changes[$key])) {
                    continue;
                }

                $oldValue = $order->getOriginal($key);
                if ($oldValue != $newValue && ! (empty($oldValue) && empty($newValue))) {
                    $changes[$key] = [
                        'old' => $oldValue,
                        'new' => $newValue,
                    ];
                }
            }

            if (! empty($changes)) {
                $order->logAction('updated', ['changes' => $changes]);
            } else {
                $order->save();
            }

            return $order;
        });
    }

    public function addItem($orderId, $variantId, $quantity, $unitPrice = null, array $discountData = [])
    {
        return DB::transaction(function () use ($orderId, $variantId, $quantity, $unitPrice, $discountData) {
            $order = SalesOrder::findOrFail($orderId);

            if ($order->status !== 'pending') {
                throw new Exception('Cannot add items to an order that is not pending.');
            }

            $this->processAddItem($order, $variantId, $quantity, $unitPrice, $discountData);

            $this->recalculateTotals($order);
            $order->logAction('item_added', ['product_variant_id' => $variantId, 'qty' => $quantity]);

            return $order->load('items.productVariant.product');
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

            if (isset($data['delivery_fee'])) {
                $order->delivery_fee = (float) $data['delivery_fee'];
            }
            if (isset($data['courier_service_fee'])) {
                $order->courier_service_fee = (float) $data['courier_service_fee'];
            }
            if (isset($data['overcharge'])) {
                $order->overcharge = (float) $data['overcharge'];
            }

            if (isset($data['is_deli_prepaid'])) {
                $order->is_deli_prepaid = (bool) $data['is_deli_prepaid'];
            }
            if (isset($data['money_collected_by'])) {
                $order->money_collected_by = $data['money_collected_by'];
            }

            $order->status = 'delivery_added';

            $this->recalculateTotals($order);

            // Upfront Courier Fee Payout if fully prepaid
            if ($order->courier_id && $order->money_collected_by === 'seller' && $order->is_deli_prepaid) {
                $feeToPay = $order->customer_grand_total - $order->net_revenue;

                if ($feeToPay > 0 && $order->settlement_status !== 'settled' && $order->paid_amount >= $order->customer_grand_total) {
                    app(CashFlowService::class)->recordOutflow(
                        $order->shop_id,
                        $feeToPay,
                        'expense',
                        'Upfront Courier fee payout for Order #'.$order->id,
                        SalesOrder::class,
                        $order->id
                    );

                    $order->settlement_status = 'settled';
                    $order->save();
                }
            }

            $order->logAction('fulfillment_details_updated');

            return $order;
        });
    }

    public function markAsDelivered($id)
    {
        return DB::transaction(function () use ($id) {
            $order = SalesOrder::findOrFail($id);
            if ($order->status !== 'delivery_added') {
                throw new Exception('Order must have delivery arranged before it can be marked as delivered.');
            }

            $order->status = 'delivered';

            // If it's fully prepaid (deli prepaid and grand total paid), we might consider it complete, but user said prepaid ends at 'delivered'.
            // For now, just set to delivered.
            $order->save();

            $order->logAction('delivered');

            return $order;
        });
    }

    public function settle($id, $paymentMethod = null, $refundAmount = null)
    {
        return DB::transaction(function () use ($id, $paymentMethod, $refundAmount) {
            $order = SalesOrder::findOrFail($id);

            // Case 1: Order with Courier Settlement
            if ($order->courier_id) {
                $targetPayment = ($order->money_collected_by === 'seller' && $order->is_deli_prepaid)
                    ? $order->customer_grand_total
                    : $order->net_revenue;

                $amountToPay = $targetPayment - $order->paid_amount;

                if ($order->settlement_status === 'settled' && $amountToPay == 0) {
                    if ($order->status !== 'completed') {
                        $order->update(['status' => 'completed']);
                        $order->logAction('settled');

                        return $order;
                    }
                    throw new Exception('Order is already settled and completed.');
                }

                $newPaidAmount = $order->paid_amount;

                if ($amountToPay > 0) {
                    $order->payments()->create([
                        'amount' => $amountToPay,
                        'payment_method' => $paymentMethod ?? 'cash',
                    ]);

                    app(CashFlowService::class)->recordInflow(
                        $order->shop_id,
                        $amountToPay,
                        'sale',
                        'Courier settlement for Order #'.$order->id,
                        SalesOrder::class,
                        $order->id
                    );
                    $newPaidAmount += $amountToPay;
                } elseif ($amountToPay < 0) {
                    $owed = abs($amountToPay);
                    $refundToIssue = $refundAmount ?? $owed;
                    $retained = $owed - $refundToIssue;

                    if ($refundToIssue > 0) {
                        $order->payments()->create([
                            'amount' => -$refundToIssue,
                            'payment_method' => $paymentMethod ?? 'cash',
                        ]);
                        app(CashFlowService::class)->recordOutflow(
                            $order->shop_id,
                            $refundToIssue,
                            'refund',
                            'Courier fee payout for Order #'.$order->id,
                            SalesOrder::class,
                            $order->id
                        );
                        $newPaidAmount -= $refundToIssue;
                    }
                    if ($retained > 0) {
                        $order->retained_revenue += $retained;
                        $newPaidAmount -= $retained;
                        $order->save();
                    }
                }

                $order->update([
                    'settlement_status' => 'settled',
                    'payment_status' => 'paid',
                    'paid_amount' => $newPaidAmount,
                    'status' => 'completed',
                ]);
            }
            // Case 2: In-Store Sale (No Courier)
            else {
                $amountToPay = $order->customer_grand_total - $order->paid_amount;

                if ($order->payment_status === 'paid' && $amountToPay == 0) {
                    if ($order->status !== 'completed') {
                        $order->update(['status' => 'completed']);
                        $order->logAction('settled');

                        return $order;
                    }
                    throw new Exception('Order is already fully paid and completed.');
                }

                $newPaidAmount = $order->paid_amount;

                if ($amountToPay > 0) {
                    $order->payments()->create([
                        'amount' => $amountToPay,
                        'payment_method' => $paymentMethod ?? 'cash',
                    ]);

                    app(CashFlowService::class)->recordInflow(
                        $order->shop_id,
                        $amountToPay,
                        'sale',
                        'Direct customer payment for Order #'.$order->id,
                        SalesOrder::class,
                        $order->id
                    );
                    $newPaidAmount += $amountToPay;
                } elseif ($amountToPay < 0) {
                    $owed = abs($amountToPay);
                    $refundToIssue = $refundAmount ?? $owed;
                    $retained = $owed - $refundToIssue;

                    if ($refundToIssue > 0) {
                        $order->payments()->create([
                            'amount' => -$refundToIssue,
                            'payment_method' => $paymentMethod ?? 'cash',
                        ]);
                        app(CashFlowService::class)->recordOutflow(
                            $order->shop_id,
                            $refundToIssue,
                            'refund',
                            'Refund for Direct overpayment: Order #'.$order->id,
                            SalesOrder::class,
                            $order->id
                        );
                        $newPaidAmount -= $refundToIssue;
                    }
                    if ($retained > 0) {
                        $order->retained_revenue += $retained;
                        $newPaidAmount -= $retained;
                        $order->save();
                    }
                }

                $order->update([
                    'payment_status' => 'paid',
                    'paid_amount' => $newPaidAmount,
                    'status' => 'completed',
                ]);
            }

            $this->recalculateTotals($order);

            $order->logAction('settled');

            return $order;
        });
    }

    public function issueRefund($id, $paymentMethod = null, $refundAmount = null)
    {
        return DB::transaction(function () use ($id, $paymentMethod, $refundAmount) {
            $order = SalesOrder::findOrFail($id);

            $isPrepaidCourier = $order->courier_id && $order->money_collected_by === 'seller' && $order->is_deli_prepaid;
            $targetAmount = ($order->courier_id && ! $isPrepaidCourier) ? $order->net_revenue : $order->customer_grand_total;
            $owed = $order->paid_amount - $targetAmount;

            if ($owed <= 0) {
                throw new Exception('No refund is due.');
            }

            $refundToIssue = $refundAmount ?? $owed;
            $retained = $owed - $refundToIssue;

            if ($refundToIssue > 0) {
                $order->payments()->create([
                    'amount' => -$refundToIssue,
                    'payment_method' => $paymentMethod ?? 'cash',
                ]);

                app(CashFlowService::class)->recordOutflow(
                    $order->shop_id,
                    $refundToIssue,
                    'refund',
                    'Refund for Order #'.$order->id,
                    SalesOrder::class,
                    $order->id
                );
                $order->paid_amount -= $refundToIssue;
            }

            if ($retained > 0) {
                $order->retained_revenue += $retained;
                $order->paid_amount -= $retained;
            }

            $order->save();
            $this->recalculateTotals($order);

            $order->logAction('refund_issued');

            return $order;
        });
    }

    public function batchSettle(array $orderIds, $paymentMethod)
    {
        return DB::transaction(function () use ($orderIds, $paymentMethod) {
            $settledCount = 0;
            foreach ($orderIds as $id) {
                $this->settle($id, $paymentMethod);
                $settledCount++;
            }

            return $settledCount;
        });
    }

    // --- 4. CANCELLATION & RETURNS ---

    public function cancelOrder($id, $reason = 'Manual Cancellation', $cancellationFee = 0, $cancellationFeeReason = null, $refundAmount = null, $paymentMethod = null)
    {
        return DB::transaction(function () use ($id, $reason, $cancellationFee, $cancellationFeeReason, $refundAmount, $paymentMethod) {
            $order = SalesOrder::with('items')->findOrFail($id);
            if ($order->status === 'cancelled') {
                throw new Exception('Order is already cancelled.');
            }

            /** @var SalesOrderItem $item */
            foreach ($order->items as $item) {
                $variant = ProductVariant::withTrashed()->lockForUpdate()->find($item->product_variant_id);
                if ($variant) {
                    $variant->increment('stock_quantity', $item->quantity);
                    $this->createLog($order, $variant, $item->quantity, 'sale_cancelled_return');
                }
                $this->restoreBatches($item);
            }

            $refundToIssue = $refundAmount ?? $order->paid_amount;
            $retained = $order->paid_amount - $refundToIssue;

            if ($refundToIssue > 0) {
                $order->payments()->create([
                    'amount' => -$refundToIssue,
                    'payment_method' => $paymentMethod ?? 'cash',
                ]);
                app(CashFlowService::class)->recordOutflow(
                    $order->shop_id,
                    $refundToIssue,
                    'refund',
                    'Refund for Cancelled Order #'.$order->id,
                    SalesOrder::class,
                    $order->id
                );
            }
            if ($retained > 0) {
                $order->retained_revenue += $retained;
                $order->save();
            }

            $order->status = 'cancelled';
            $order->cancel_reason = $reason;
            $order->net_revenue = 0;
            $order->customer_grand_total = 0;
            $order->paid_amount = 0;
            $order->logAction('cancelled', ['reason' => $reason]);
            $order->save();

            if ($cancellationFee > 0) {
                $expense = Expense::create([
                    'title' => 'Cancel Fee (Order #'.$order->id.'): '.($cancellationFeeReason ?? 'No reason provided'),
                    'amount' => $cancellationFee,
                    'incurred_at' => now(),
                    'category' => 'Cancellation Fee',
                    'note' => 'Fee incurred during order cancellation.',
                ]);

                app(CashFlowService::class)->recordOutflow(
                    $expense->shop_id,
                    $expense->amount,
                    'expense',
                    $expense->title,
                    Expense::class,
                    $expense->id
                );
            }

            return $order;
        });
    }

    public function returnItem($orderId, $itemId, $quantity, $reason = 'Customer Return')
    {
        return DB::transaction(function () use ($orderId, $itemId, $quantity, $reason) {
            $order = SalesOrder::findOrFail($orderId);
            $item = SalesOrderItem::where('sales_order_id', $orderId)->where('id', $itemId)->firstOrFail();

            if ($quantity > $item->quantity) {
                throw new Exception('Cannot return more than sold quantity.');
            }

            // 1. Restore Stock
            $variant = ProductVariant::withTrashed()->lockForUpdate()->find($item->product_variant_id);
            if ($variant) {
                $variant->increment('stock_quantity', $quantity);

                // Log context: If pending, it's just removing. If completed, it's a return.
                $logType = ($order->status === 'pending') ? 'sale_item_removed' : 'sale_return_partial';
                $this->createLog($order, $variant, $quantity, $logType);
            }

            $this->restoreBatches($item, $quantity);

            // 2. Adjust Item (Price reduction proportional to quantity)
            $originalQty = $item->quantity;
            $discountPerUnit = $originalQty > 0 ? ($item->discount_amount / $originalQty) : 0;

            $refundLineTotal = ($item->unit_price - $discountPerUnit) * $quantity;
            $refundDiscountAmount = $discountPerUnit * $quantity;

            $item->quantity -= $quantity;
            $item->line_total -= $refundLineTotal;
            $item->discount_amount -= $refundDiscountAmount;

            if ($item->quantity <= 0) {
                $item->delete();
            } else {
                $item->save();
            }

            // 3. Recalculate (This will drop Grand Total, likely causing 'overpaid' status)
            $this->recalculateTotals($order);

            $order->logAction('item_returned', [
                'product' => $variant->sku ?? 'Unknown',
                'qty' => $quantity,
                'reason' => $reason,
            ]);

            return $order->load('items');
        });
    }

    // --- HELPERS ---

    private function processAddItem(SalesOrder $order, $variantId, $qty, $priceOverride = null, $discountData = [])
    {
        $variant = ProductVariant::with('product')->lockForUpdate()->find($variantId);

        if (! $variant || ($variant->stock_quantity + $variant->pending_stock) < $qty) {
            $productName = $variant->product ? $variant->product->name : 'Unknown';
            throw new Exception("Stock limit exceeded for: {$productName} ({$variant->sku})");
        }

        $isPreorder = $qty > $variant->stock_quantity;

        $variant->decrement('stock_quantity', $qty);

        $discountType = $discountData['discount_type'] ?? 'none';
        $discountValue = (float) ($discountData['discount_value'] ?? 0);
        $discountReason = $discountData['discount_reason'] ?? null;

        // FIFO Batch Deduction Logic
        $remainingQtyNeeded = $qty;

        $activeBatches = ProductBatch::where('product_variant_id', $variant->id)
            ->where('shop_id', $order->shop_id)
            ->where('remaining_quantity', '>', 0)
            ->orderBy('created_at', 'asc')
            ->get();

        foreach ($activeBatches as $batch) {
            if ($remainingQtyNeeded <= 0) {
                break;
            }

            $takeQty = min($batch->remaining_quantity, $remainingQtyNeeded);
            $batchCost = $takeQty * $batch->unit_cost;

            $sellingPrice = $priceOverride !== null ? $priceOverride : $variant->effective_retail_price;

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
                'product_variant_id' => $variant->id,
                'quantity' => $takeQty,
                'unit_price' => $sellingPrice,
                'unit_cost' => $batch->unit_cost,
                'line_total' => $lineTotal,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_amount' => $totalDiscountAmount,
                'discount_reason' => $discountReason,
                'batch_breakdown' => [['batch_id' => $batch->id, 'taken' => $takeQty, 'unit_cost' => (float) $batch->unit_cost, 'total_cost' => $batchCost]],
            ]);

            $remainingQtyNeeded -= $takeQty;
            $batch->decrement('remaining_quantity', $takeQty);
        }

        // Handle pre-orders using a "Virtual FIFO" across Pending POs
        if ($remainingQtyNeeded > 0) {
            $lastBatch = ProductBatch::where('product_variant_id', $variant->id)
                ->where('shop_id', $order->shop_id)
                ->latest('created_at')
                ->first();

            // Fetch all pending PO items for this product
            $pendingPoItems = PurchaseOrderItem::where('product_variant_id', $variant->id)
                ->whereHas('purchaseOrder', function ($q) use ($order) {
                    $q->where('shop_id', $order->shop_id)
                        ->where('status', 'pending');
                })
                ->orderBy('created_at', 'asc')
                ->get();

            // Calculate how many pending items were already spoken for (pre-ordered in past sales)
            $originalStock = $variant->stock_quantity + $qty; // Stock before this sale decremented it
            $preorderedBeforeThisSale = $originalStock < 0 ? abs($originalStock) : 0;

            $skippedQty = 0;

            foreach ($pendingPoItems as $poItem) {
                if ($remainingQtyNeeded <= 0) {
                    break;
                }

                $availableInThisPo = $poItem->quantity;

                // Skip items that belong to older pre-orders
                if ($skippedQty < $preorderedBeforeThisSale) {
                    $toSkipHere = min($availableInThisPo, $preorderedBeforeThisSale - $skippedQty);
                    $availableInThisPo -= $toSkipHere;
                    $skippedQty += $toSkipHere;
                }

                if ($availableInThisPo <= 0) {
                    continue;
                }

                $takeQty = min($availableInThisPo, $remainingQtyNeeded);

                $fallbackCost = $poItem->unit_cost;
                $fallbackRetail = $poItem->retail_price ?? $variant->effective_retail_price;

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
                    'product_variant_id' => $variant->id,
                    'quantity' => $takeQty,
                    'unit_price' => $sellingPrice,
                    'unit_cost' => $fallbackCost,
                    'line_total' => $lineTotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $totalDiscountAmount,
                    'discount_reason' => $discountReason,
                    'batch_breakdown' => [['batch_id' => null, 'note' => 'Pre-order / Pending PO #'.$poItem->purchase_order_id, 'taken' => $takeQty, 'unit_cost' => (float) $fallbackCost, 'total_cost' => $fallbackTotalCost]],
                ]);

                $remainingQtyNeeded -= $takeQty;
            }

            // If they still oversold beyond all pending POs, fallback to base cost
            if ($remainingQtyNeeded > 0) {
                // For variant, fallback to product base cost if we must
                $fallbackCost = $lastBatch ? $lastBatch->unit_cost : ($variant->product->base_cost ?? 0);
                $fallbackRetail = $variant->effective_retail_price;

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
                    'product_variant_id' => $variant->id,
                    'quantity' => $remainingQtyNeeded,
                    'unit_price' => $sellingPrice,
                    'unit_cost' => $fallbackCost,
                    'line_total' => $lineTotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $totalDiscountAmount,
                    'discount_reason' => $discountReason,
                    'batch_breakdown' => [['batch_id' => null, 'note' => 'Pre-order / Missing Batch', 'taken' => $remainingQtyNeeded, 'unit_cost' => (float) $fallbackCost, 'total_cost' => $fallbackTotalCost]],
                ]);
            }
        }

        $this->createLog($order, $variant, $qty, 'sale_sold');

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
        if ($order->discount_type === 'fixed') {
            $discountAmount = $order->discount_value;
        } elseif ($order->discount_type === 'percent') {
            $discountAmount = $subtotal * ($order->discount_value / 100);
        }

        return min($discountAmount, $subtotal);
    }

    private function calculateLogistics(SalesOrder $order, $afterDiscount)
    {
        $netRevenue = $afterDiscount + $order->overcharge + $order->extra_fee - $order->courier_service_fee;
        $customerGrandTotal = $afterDiscount + $order->delivery_fee + $order->overcharge + $order->extra_fee;

        if ($order->courier_id) {
            if ($order->settlement_status !== 'settled') {
                $order->settlement_status = 'unpaid';
            }
        } else {
            $order->settlement_status = 'unpaid';
        }

        return [$customerGrandTotal, $netRevenue];
    }

    private function determinePaymentStatus(SalesOrder $order, $customerGrandTotal, $netRevenue)
    {
        if ($order->courier_id) {
            if ($order->money_collected_by === 'seller') {
                $targetUpfront = $order->is_deli_prepaid
                    ? $customerGrandTotal
                    : (($order->subtotal - $order->discount_total) + $order->extra_fee);
                if ($order->paid_amount >= $targetUpfront) {
                    return 'paid';
                } elseif ($order->paid_amount > 0) {
                    return 'partial';
                } else {
                    return 'unpaid';
                }
            } else {
                // COD
                if ($order->settlement_status === 'settled' || $order->paid_amount >= $netRevenue) {
                    return 'paid';
                } elseif ($order->paid_amount > 0) {
                    return 'partial';
                } else {
                    return 'unpaid';
                }
            }
        }

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

        $order->payment_status = $this->determinePaymentStatus($order, $customerGrandTotal, $netRevenue);

        $order->subtotal = $subtotal;
        $order->total_cost = $totalCost;
        $order->discount_total = $discountAmount;
        $order->customer_grand_total = $customerGrandTotal;
        $order->net_revenue = $netRevenue;
        $order->net_profit = $netRevenue + $order->retained_revenue - $totalCost - $order->return_cost;
        $order->save();
    }

    private function createLog($order, $variant, $qty, $reason)
    {
        $change = ($reason === 'sale_sold') ? -abs($qty) : abs($qty);
        InventoryLog::create([
            'shop_id' => $order->shop_id,
            'product_variant_id' => $variant->id,
            'quantity_change' => $change,
            'new_stock_level' => $variant->stock_quantity,
            'reason' => $reason,
            'reference_type' => SalesOrder::class,
            'reference_id' => $order->id,
            'note' => "Order #{$order->id}",
        ]);
    }

    private function restoreBatches(SalesOrderItem $item, $returnQty = null)
    {
        $breakdown = $item->batch_breakdown;
        if (! is_array($breakdown) || empty($breakdown)) {
            return;
        }

        $qtyToRestore = $returnQty ?? $item->quantity;

        // Reverse order so we put back into the newest batches first (LIFO restore)
        for ($i = count($breakdown) - 1; $i >= 0; $i--) {
            if ($qtyToRestore <= 0) {
                break;
            }

            $b = &$breakdown[$i];

            if ($b['batch_id'] === null) {
                $restoreAmount = min($b['taken'], $qtyToRestore);
                $b['taken'] -= $restoreAmount;
                $qtyToRestore -= $restoreAmount;

                continue;
            }

            $batch = ProductBatch::find($b['batch_id']);
            if ($batch) {
                $restoreAmount = min($b['taken'], $qtyToRestore);
                $batch->increment('remaining_quantity', $restoreAmount);
                $b['taken'] -= $restoreAmount;
                $qtyToRestore -= $restoreAmount;
            }
        }

        $item->batch_breakdown = $breakdown;
        $item->save();
    }
}
