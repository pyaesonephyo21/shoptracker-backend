<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Models\SalesOrder;
use App\Models\Product;
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
        // Only count completed or delivered orders for actual revenue/profit
        $ordersInRange = SalesOrder::whereBetween('created_at', [$startDate, $endDate])
            ->whereIn('status', ['delivered', 'completed', 'money_collected'])
            ->get();

        $netRevenue = $ordersInRange->sum('net_revenue');
        $netProfit = $ordersInRange->sum('net_profit');

        // 3. Inventory Value (All Time Active)
        $products = Product::all();
        $totalStockCost = 0;
        $totalStockRetail = 0;
        $lowStockProducts = [];

        foreach ($products as $product) {
            $qty = $product->stock_quantity;
            if ($qty > 0) {
                $totalStockCost += ($product->base_cost * $qty);
                $totalStockRetail += ($product->retail_price * $qty);
            }
            if ($qty <= 5) { // Low stock threshold
                $lowStockProducts[] = [
                    'id' => $product->id,
                    'name' => $product->name,
                    'stock_quantity' => $qty,
                    'retail_price' => $product->retail_price,
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
        $unsettledDeliveries = SalesOrder::with(['courier'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'delivered')
            ->where('settlement_status', 'unpaid')
            ->orderBy('created_at', 'desc')
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
                'net_profit' => $netProfit,
                'inventory_cost' => $totalStockCost,
                'inventory_retail' => $totalStockRetail,
            ],
            'lowStockProducts' => array_slice($lowStockProducts, 0, 10), // Top 10 lowest
            'unsettledDeliveries' => $unsettledDeliveries,
        ]);
    }
}
