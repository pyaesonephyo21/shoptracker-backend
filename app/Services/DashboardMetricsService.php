<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\PaymentMethod;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\SalesOrderPayment;
use Carbon\Carbon;

class DashboardMetricsService
{
    /**
     * Calculate all dashboard metrics for a given date range and status filter.
     */
    public function getMetrics(Carbon $startDate, Carbon $endDate, string $statusFilter): array
    {
        $statusMap = [
            'completed' => ['completed'],
            'delivered' => ['delivered', 'completed'],
            'all' => ['pending', 'delivery_added', 'delivered', 'completed'],
        ];

        $revenueStatus = $statusMap[$statusFilter] ?? ['completed'];

        // 1. Financial Metrics within date range
        $ordersInRange = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->whereIn('status', $revenueStatus)
            ->get();

        $netRevenue = $ordersInRange->sum('net_revenue') + $ordersInRange->sum('retained_revenue');
        $grossProfit = $ordersInRange->sum('net_profit');

        // Include retained revenue from cancelled orders
        $cancelledRetained = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'cancelled')
            ->where('retained_revenue', '>', 0)
            ->get();

        $netRevenue += $cancelledRetained->sum('retained_revenue');
        $grossProfit += $cancelledRetained->sum('retained_revenue');

        // Calculate Other Expenses
        $expensesInRange = Expense::whereBetween('incurred_at', [$startDate, $endDate])->get();
        $totalExpenses = $expensesInRange->sum('amount');

        // Include PO fees as expenses
        $poExpenses = PurchaseOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'arrived')
            ->get()
            ->sum(function ($po) {
                return $po->local_deli_fee ?: 0;
            });

        $totalExpenses += $poExpenses;
        $netProfit = $grossProfit - $totalExpenses;

        // 2. Order Alerts
        $pendingOrdersQuery = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'pending');
        $pendingOrdersCount = $pendingOrdersQuery->count();
        $pendingOrdersValue = $pendingOrdersQuery->sum('customer_grand_total');

        $deliveryAddedQuery = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'delivery_added');
        $deliveryAddedCount = $deliveryAddedQuery->count();
        $deliveryAddedValue = $deliveryAddedQuery->sum('customer_grand_total');

        // 3. Inventory Value (All Time Active)
        $variants = ProductVariant::with('product')
            ->whereHas('product', function ($query) {
                $query->where('is_active', true);
            })
            ->get();

        $totalStockCost = 0;
        $totalStockRetail = 0;
        $batches = ProductBatch::where('remaining_quantity', '>', 0)->get();
        foreach ($batches as $batch) {
            $totalStockCost += ($batch->unit_cost * $batch->remaining_quantity);
            $totalStockRetail += ($batch->retail_price * $batch->remaining_quantity);
        }

        $lowStockProducts = [];
        foreach ($variants as $variant) {
            $qty = $variant->stock_quantity;
            if ($qty <= 5) { // Low stock threshold
                $name = $variant->product ? $variant->product->name : 'Unknown Product';
                if ($variant->sku) {
                    $name .= " ({$variant->sku})";
                }

                $lowStockProducts[] = [
                    'id' => $variant->product_id,
                    'name' => $name,
                    'stock_quantity' => $qty,
                    'pending_stock' => $variant->pending_stock,
                    'retail_price' => $variant->effective_retail_price,
                ];
            }
        }

        usort($lowStockProducts, function ($a, $b) {
            return $a['stock_quantity'] <=> $b['stock_quantity'];
        });

        // 4. Unsettled Deliveries (Bounded by date as requested)
        $unsettledDeliveriesQuery = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'delivered')
            ->where('settlement_status', 'unpaid');

        $totalUnsettledCount = $unsettledDeliveriesQuery->count();
        $totalUnsettledValue = $unsettledDeliveriesQuery->selectRaw('SUM(CASE WHEN courier_id IS NOT NULL THEN (net_revenue - paid_amount) ELSE (customer_grand_total - paid_amount) END) as total')->value('total') ?? 0;

        // 5. Cash Flow Breakdown (Payments in date range)
        $paymentsInRange = SalesOrderPayment::whereBetween('created_at', [$startDate, $endDate])
            ->whereHas('salesOrder')
            ->selectRaw('payment_method, sum(amount) as total')
            ->groupBy('payment_method')
            ->get();

        $activeMethods = PaymentMethod::all()->keyBy('code');
        $cashFlow = [];
        $totalCollected = 0;

        foreach ($paymentsInRange as $payment) {
            $methodName = isset($activeMethods[$payment->payment_method]) ? $activeMethods[$payment->payment_method]->name : ucfirst($payment->payment_method);
            $cashFlow[] = [
                'method' => $methodName,
                'amount' => (float) $payment->total,
            ];
            $totalCollected += $payment->total;
        }

        usort($cashFlow, function ($a, $b) {
            return $b['amount'] <=> $a['amount'];
        });

        return [
            'metrics' => [
                'net_revenue' => $netRevenue,
                'gross_profit' => $grossProfit,
                'total_expenses' => $totalExpenses,
                'net_profit' => $netProfit,
                'inventory_cost' => $totalStockCost,
                'inventory_retail' => $totalStockRetail,
            ],
            'alerts' => [
                'pending_orders' => [
                    'total_count' => $pendingOrdersCount,
                    'total_value' => $pendingOrdersValue,
                ],
                'delivery_added' => [
                    'total_count' => $deliveryAddedCount,
                    'total_value' => $deliveryAddedValue,
                ],
                'unsettled_deliveries' => [
                    'total_count' => $totalUnsettledCount,
                    'total_value' => $totalUnsettledValue,
                ],
                'low_stock' => [
                    'total_count' => count($lowStockProducts),
                ],
            ],
            'cashFlow' => [
                'items' => $cashFlow,
                'total' => $totalCollected,
            ],
        ];
    }
}
