<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Models\SalesOrder;
use App\Models\Product;
use App\Models\Expense;
use App\Models\PurchaseOrder;
use App\Models\ProductVariant;
use App\Models\ProductBatch;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // 1. Date Range
        $startDate = $request->input('start_date') 
            ? Carbon::parse($request->input('start_date'))->startOfDay() 
            : Carbon::now()->startOfMonth();
            
        $endDate = $request->input('end_date') 
            ? Carbon::parse($request->input('end_date'))->endOfDay() 
            : Carbon::now()->endOfDay();

        // 2. Financial Metrics within date range
        // Only count completed or money_collected orders for actual revenue/profit
        $ordersInRange = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->whereIn('status', ['completed', 'money_collected'])
            ->get();

        $netRevenue = $ordersInRange->sum('net_revenue');
        $grossProfit = $ordersInRange->sum('net_profit'); // Before expenses

        // 2.5 Calculate Other Expenses
        $expensesInRange = Expense::whereBetween('incurred_at', [$startDate, $endDate])->get();
        $totalExpenses = $expensesInRange->sum('amount');

        // Include PO fees as expenses
        $poExpenses = PurchaseOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'arrived')
            ->get()
            ->sum(function($po) {
                return $po->local_deli_fee ?: 0;
            });

        $totalExpenses += $poExpenses;

        $netProfit = $grossProfit - $totalExpenses;

        // Orders needing delivery (status = pending)
        $ordersNeedingDeliveryCount = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'pending')
            ->count();

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

        // Sort low stock by quantity ascending
        usort($lowStockProducts, function ($a, $b) {
            return $a['stock_quantity'] <=> $b['stock_quantity'];
        });

        // 4. Unsettled Deliveries (Any Date, or maybe bounded by date? Better to show all unsettled so none are missed)
        // Or if the user wants it bounded by date, we will apply the date range.
        // User said: "I also wanna see delivered orders that are not settled. lets also add date range filter so that I can check however I want."
        // Let's bind it to the date range so it filters alongside everything else.
        $unsettledDeliveriesQuery = SalesOrder::with(['courier'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'delivered')
            ->where('settlement_status', 'unpaid')
            ->orderBy('created_at', 'desc');

        $totalUnsettledCount = $unsettledDeliveriesQuery->count();
        $unsettledDeliveries = $unsettledDeliveriesQuery
            ->take(50)
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'date' => $order->created_at->format('M d, Y'),
                    'customer_name' => $order->customer_name ?: 'Walk-in',
                    'courier_name' => optional($order->courier)->name ?: 'N/A',
                    'balance' => $order->customer_grand_total - $order->paid_amount,
                ];
            });

        return Inertia::render('Dashboard', [
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
            ],
            'metrics' => [
                'net_revenue' => $netRevenue,
                'gross_profit' => $grossProfit,
                'total_expenses' => $totalExpenses,
                'net_profit' => $netProfit,
                'pending_orders_count' => $ordersNeedingDeliveryCount,
                'inventory_cost' => $totalStockCost,
                'inventory_retail' => $totalStockRetail,
            ],
            'lowStockProducts' => [
                'items' => array_slice($lowStockProducts, 0, 50),
                'total_count' => count($lowStockProducts),
            ],
            'unsettledDeliveries' => [
                'items' => $unsettledDeliveries,
                'total_count' => $totalUnsettledCount,
            ],
        ]);
    }
}
