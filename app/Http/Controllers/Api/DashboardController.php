<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\InventoryLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // 1. Inventory Summary
        // We calculate this in the Database (SQL), not in PHP (faster)
        $inventoryStats = Product::toBase()
            ->selectRaw('count(*) as total_items')
            ->selectRaw('COALESCE(sum(stock_quantity), 0) as total_units')
            ->selectRaw('COALESCE(sum(stock_quantity * base_cost), 0) as total_inventory_value')
            ->selectRaw('COALESCE(sum(stock_quantity * retail_price), 0) as potential_revenue')
            ->where('shop_id', auth()->user()->shop_id)
            ->first();

        // 2. Low Stock Alerts (e.g., less than 10 units)
        $lowStockItems = Product::select('id', 'name', 'stock_quantity', 'sku')
            ->where('stock_quantity', '<=', 3)
            ->orderBy('stock_quantity', 'asc')
            ->limit(5)
            ->get();

        // 3. Today's Sales Performance
        $todaySales = SalesOrder::query()
            ->whereDate('created_at', now()->today())
            ->selectRaw('count(*) as orders_count')
            ->selectRaw('COALESCE(sum(customer_grand_total), 0) as revenue')
            ->selectRaw('COALESCE(sum(net_profit), 0) as profit')
            ->first();

        $itemsSoldToday = DB::table('sales_order_items')
            ->join('sales_orders', 'sales_orders.id', '=', 'sales_order_items.sales_order_id')
            ->where('sales_orders.shop_id', auth()->user()->shop_id)
            ->whereDate('sales_orders.created_at', now()->today())
            ->sum('sales_order_items.quantity');

        // 4. Recent Activity Feed (Using the Logs we created!)
        // We load the 'product' relationship so we can show names "White Shirt", not just "Product #1"
        $recentActivity = InventoryLog::with('product:id,name,sku')
            ->latest()
            ->limit(5)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'product' => $log->product->name ?? 'Unknown',
                    'change' => $log->quantity_change > 0 ? "+{$log->quantity_change}" : $log->quantity_change,
                    'reason' => $this->formatReason($log->reason),
                    'time' => $log->created_at->diffForHumans()
                ];
            });

        return response()->json([
            'stats' => [
                'total_items' => $inventoryStats->total_items,
                'inventory_value' => (float) $inventoryStats->total_inventory_value,
                'potential_revenue' => (float) $inventoryStats->potential_revenue,
            ],
            'today' => [
                'orders' => $todaySales->orders_count,
                'items_sold' => (int) $itemsSoldToday,
                'revenue' => (float) $todaySales->revenue ?? 0,
                'profit' => (float) $todaySales->profit ?? 0,
            ],
            'alerts' => $lowStockItems,
            'feed' => $recentActivity
        ]);
    }

    // Helper to make "sale_sold" look like "Sold Item"
    private function formatReason($reason)
    {
        return match ($reason) {
            'purchase_arrived' => 'Stock Arrived',
            'sale_sold' => 'Item Sold',
            'adjustment_damage' => 'Damaged',
            'adjustment_loss' => 'Lost',
            'adjustment_return' => 'return',
            default => ucfirst(str_replace('_', ' ', $reason))
        };
    }
}
