<?php

namespace App\Services;

use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\InventoryLog;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Exception;

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
                'delivery_fee' => 0,
                'courier_service_fee' => 0,

                // Order Level Discount
                'discount_type' => (string) ($data['discount_type'] ?? 'none'),
                'discount_value' => (float) ($data['discount_value'] ?? 0),
                'discount_reason' => (string) ($data['discount_reason'] ?? ''),

                // Initial Payment
                'paid_amount' => (float) ($data['paid_amount'] ?? 0),

                // Audit
                'audit_log' => [['action' => 'created', 'by' => auth()->user()->name, 'at' => now()->toIso8601String()]]
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

            // Update basic fields
            $order->fill(collect($data)->only([
                'customer_name',
                'customer_phone',
                'delivery_address',
                'note',
                'tracking_number',
                'discount_reason'
            ])->toArray());

            // Check if financials need recalculation
            $recalcNeeded = false;

            if (isset($data['delivery_fee'])) {
                $order->delivery_fee = (float) $data['delivery_fee'];
                $recalcNeeded = true;
            }
            if (isset($data['discount_value'])) {
                $order->discount_value = (float) $data['discount_value'];
                $recalcNeeded = true;
            }

            if ($recalcNeeded) {
                $this->recalculateTotals($order);
            } else {
                $order->save();
            }

            $order->logAction('updated', array_keys($data));
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

            $order->status = 'delivery added';

            $this->recalculateTotals($order);
            $order->logAction('fulfillment_details_updated');

            return $order;
        });
    }

    public function markAsDelivered($id)
    {
        return DB::transaction(function () use ($id) {
            $order = SalesOrder::findOrFail($id);
            if ($order->status !== 'delivery added') {
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

            foreach ($order->items as $item) {
                Product::find($item->product_id)->increment('stock_quantity', $item->quantity);
                $this->createLog($order, Product::find($item->product_id), $item->quantity, 'sale_cancelled_return');
            }

            $order->status = 'cancelled';
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
            $product = Product::find($item->product_id);
            if ($product) {
                $product->increment('stock_quantity', $quantity);

                // Log context: If pending, it's just removing. If completed, it's a return.
                $logType = ($order->status === 'pending') ? 'sale_item_removed' : 'sale_return_partial';
                $this->createLog($order, $product, $quantity, $logType);
            }

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

        $sellingPrice = $priceOverride !== null ? $priceOverride : $product->retail_price;
        $buyingCost = $product->base_cost;

        // 1. Calculate Item-Level Discount
        $discountType = $discountData['discount_type'] ?? 'none';
        $discountValue = (float) ($discountData['discount_value'] ?? 0);
        $discountReason = $discountData['discount_reason'] ?? null;

        $itemDiscountPerUnit = 0;
        if ($discountType === 'fixed') {
            $itemDiscountPerUnit = $discountValue;
        } elseif ($discountType === 'percent') {
            $itemDiscountPerUnit = $sellingPrice * ($discountValue / 100);
        }
        $itemDiscountPerUnit = min($itemDiscountPerUnit, $sellingPrice);

        // 2. Calculate Totals
        // Storing "unit_price" as the ORIGINAL selling price
        // Discount is tracked separately
        $lineTotal = ($sellingPrice - $itemDiscountPerUnit) * $qty;
        $totalDiscountAmount = $itemDiscountPerUnit * $qty;

        $order->items()->create([
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $sellingPrice,
            'unit_cost'  => $buyingCost,
            'line_total' => $lineTotal,

            // New Columns
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $totalDiscountAmount,
            'discount_reason' => $discountReason
        ]);

        $this->createLog($order, $product, $qty, 'sale_sold');
        
        return $isPreorder;
    }

    private function recalculateTotals(SalesOrder $order)
    {
        // 1. Sum Items (Already includes item-level discounts in line_total)
        $subtotal = $order->items()->sum('line_total');

        // 2. Total Cost
        $totalCost = $order->items->sum(function ($item) {
            return $item->quantity * $item->unit_cost;
        });

        // 3. Order-Level Discount (Applied on top of Item Discounts)
        $discountAmount = 0;
        if ($order->discount_type === 'fixed') $discountAmount = $order->discount_value;
        elseif ($order->discount_type === 'percent') $discountAmount = $subtotal * ($order->discount_value / 100);
        $discountAmount = min($discountAmount, $subtotal);

        $afterDiscount = $subtotal - $discountAmount;

        // 4. Logistics Math
        $customerGrandTotal = 0;
        $netRevenue = 0;

        if ($order->money_collected_by === 'courier') {
            $customerGrandTotal = $afterDiscount + $order->delivery_fee;
            $netRevenue = $afterDiscount - $order->courier_service_fee;
            $order->settlement_status = 'unpaid';
        } elseif ($order->is_deli_prepaid) {
            $customerGrandTotal = $afterDiscount + $order->delivery_fee;
            $netRevenue = $afterDiscount + $order->delivery_fee - $order->courier_service_fee;
        } else {
            $customerGrandTotal = $afterDiscount;
            $netRevenue = $afterDiscount - $order->courier_service_fee;
        }

        // 5. Payment Status
        if ($order->paid_amount >= $customerGrandTotal) {
            $order->payment_status = 'paid';
        } elseif ($order->paid_amount > 0) {
            $order->payment_status = 'partial';
        } else {
            $order->payment_status = 'unpaid';
        }

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
}
