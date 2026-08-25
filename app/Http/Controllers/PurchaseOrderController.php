<?php

namespace App\Http\Controllers;

use App\Exports\PurchaseOrderExport;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier'])
            ->filter($request->only(['search', 'status', 'payment_status', 'start_date', 'end_date']));

        $orders = $query->latest()->paginate(15)->withQueryString();

        return Inertia::render('Inventory/PurchaseOrderList', [
            'orders' => $orders,
            'filters' => [
                'search' => $request->search ?? '',
                'status' => $request->status ?? '',
                'payment_status' => $request->payment_status ?? '',
                'start_date' => $request->start_date ?? '',
                'end_date' => $request->end_date ?? '',
            ],
        ]);
    }

    public function export(Request $request)
    {
        $query = PurchaseOrder::with(['supplier', 'items.productVariant.product'])
            ->filter($request->only(['search', 'status', 'payment_status', 'start_date', 'end_date']));

        // Pass the query builder directly for FromQuery chunking
        $query->latest();
        $date = now()->format('Y_m_d');

        return Excel::download(new PurchaseOrderExport($query), "purchase_orders_{$date}.xlsx");
    }

    public function create()
    {
        $products = Product::with('variants')->where('is_active', true)->get();
        $products = $this->attachLatestPricesToProducts($products);
        $suppliers = Supplier::all();

        return Inertia::render('Inventory/AddPurchaseOrder', [
            'products' => $products,
            'suppliers' => $suppliers,
            'currencyLabel' => 'CNY',
            'isForeignOrder' => true,
        ]);
    }

    public function store(Request $request, PurchaseOrderService $service)
    {
        $validated = $request->validate([
            'order_type' => 'required|in:local,global',
            'batch_name' => 'nullable|string',
            'supplier_id' => 'required_if:order_type,global|nullable|exists:suppliers,id',
            'shop_name' => 'nullable|string',
            'exchange_rate' => 'required_if:order_type,global|nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.retail_price' => 'nullable|numeric|min:0',
            'foreign_deli_fee' => 'nullable|numeric|min:0',
            'total_discount' => 'nullable|numeric|min:0',
            'supplier_fee_percentage' => 'nullable|numeric|min:0',
            'paid_amount' => 'nullable|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        if (empty($validated['batch_name'])) {
            $monthPrefix = strtoupper(date('M'));
            $latestBatch = PurchaseOrder::where('batch_name', 'like', $monthPrefix.'-%')
                ->latest('id')
                ->first();

            $sequence = 1;
            if ($latestBatch && preg_match('/-(\d+)$/', $latestBatch->batch_name, $matches)) {
                $sequence = intval($matches[1]) + 1;
            }
            $validated['batch_name'] = $monthPrefix.'-'.str_pad($sequence, 3, '0', STR_PAD_LEFT);
        }

        $po = $service->createOrder($validated);

        return redirect('/inventory/purchase-orders')->with('success', 'Purchase order created successfully.');
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        $order = $purchaseOrder->load(['items.productVariant.product', 'supplier', 'activities']);

        // If order arrived, fetch associated batches to get the retail price that was set
        $batches = collect();
        if ($order->status === 'arrived') {
            $batches = ProductBatch::where('reference_type', PurchaseOrder::class)
                ->where('reference_id', $order->id)
                ->get()
                ->keyBy('product_variant_id');
        }

        foreach ($order->items as $item) {
            if ($order->status === 'arrived' && $batches->has($item->product_variant_id)) {
                $batch = $batches->get($item->product_variant_id);
                $item->batch_retail_price = $batch->retail_price;
                $item->batch_unit_cost = $batch->unit_cost;
            }

            // Fetch pricing history
            $historicalBatches = ProductBatch::where('product_variant_id', $item->product_variant_id)
                ->whereNotNull('retail_price')
                ->latest('created_at')
                ->take(3)
                ->get();

            $item->latest_retail_price = $historicalBatches->first()?->retail_price;
            $item->previous_retail_prices = $historicalBatches->slice(1, 2)->pluck('retail_price')->toArray();

            // Fetch pending retail price from other pending POs
            $pendingItem = PurchaseOrderItem::where('product_variant_id', $item->product_variant_id)
                ->whereHas('purchaseOrder', function ($q) {
                    $q->where('status', 'pending');
                })
                ->whereNotNull('retail_price')
                ->where('purchase_order_id', '!=', $order->id)
                ->latest('created_at')
                ->first();

            $item->pending_retail_price = $pendingItem ? $pendingItem->retail_price : null;
        }

        return Inertia::render('Inventory/PurchaseOrderDetail', [
            'order' => $order,
        ]);
    }

    public function edit(PurchaseOrder $purchaseOrder)
    {
        $order = $purchaseOrder->load('items.productVariant.product');

        if ($order->status !== 'pending') {
            return redirect("/inventory/purchase-orders/{$order->id}")->with('error', 'Only pending purchase orders can be edited.');
        }

        $products = Product::with('variants')->get();
        $products = $this->attachLatestPricesToProducts($products);
        $suppliers = Supplier::all();

        return Inertia::render('Inventory/EditPurchaseOrder', [
            'order' => $order,
            'products' => $products,
            'suppliers' => $suppliers,
            'currencyLabel' => 'CNY',
            'isForeignOrder' => true,
        ]);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {
        $validated = $request->validate([
            'order_type' => 'required|in:local,global',
            'batch_name' => 'nullable|string',
            'supplier_id' => 'required_if:order_type,global|nullable|exists:suppliers,id',
            'shop_name' => 'nullable|string',
            'exchange_rate' => 'required_if:order_type,global|nullable|numeric|min:1',
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.retail_price' => 'nullable|numeric|min:0',
            'foreign_deli_fee' => 'nullable|numeric|min:0',
            'total_discount' => 'nullable|numeric|min:0',
            'supplier_fee_percentage' => 'nullable|numeric|min:0',
            'paid_amount' => 'nullable|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        if (empty($validated['batch_name'])) {
            $monthPrefix = strtoupper(date('M'));
            $latestBatch = PurchaseOrder::where('batch_name', 'like', $monthPrefix.'-%')
                ->latest('id')
                ->first();

            $sequence = 1;
            if ($latestBatch && preg_match('/-(\d+)$/', $latestBatch->batch_name, $matches)) {
                $sequence = intval($matches[1]) + 1;
            }
            $validated['batch_name'] = $monthPrefix.'-'.str_pad($sequence, 3, '0', STR_PAD_LEFT);
        }

        try {
            $service->updateOrder($purchaseOrder->id, $validated);

            return redirect("/inventory/purchase-orders/{$purchaseOrder->id}")->with('success', 'Purchase order updated successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    // Assuming we need a method for arriving the PO.
    // Wait, the frontend PurchaseOrderDetail might not have an "Arrive" button yet, or it's a POST to `/inventory/purchase-orders/{id}/arrive`
    public function markAsArrived(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {

        $validated = $request->validate([
            'cargo_fee' => 'nullable|numeric|min:0',
            'local_deli_fee' => 'nullable|numeric|min:0',
            'adjustment_amount' => 'nullable|numeric',
            'adjustment_reason' => 'nullable|string|required_with:adjustment_amount',
            'received_items' => 'required|array',
            'received_items.*.id' => 'required|exists:purchase_order_items,id',
            'received_items.*.received_quantity' => 'nullable|integer|min:0',
            'received_items.*.retail_price' => 'nullable|numeric|min:0',
            'received_items.*.allocated_cargo_fee' => 'nullable|numeric',
            'received_items.*.allocated_adjustment_amount' => 'nullable|numeric',
        ]);

        try {
            $service->markAsArrived($purchaseOrder, $validated);

            return back()->with('success', 'Shipment arrival processed successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service)
    {
        $validated = $request->validate([
            'cancel_reason' => 'nullable|string',
            'refund_amount' => 'nullable|numeric|min:0',
        ]);

        try {
            $service->cancelOrder($purchaseOrder, $validated['cancel_reason'] ?? 'Manual Cancellation', $validated['refund_amount'] ?? null);

            return back()->with('success', 'Purchase order cancelled successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    private function attachLatestPricesToProducts($products)
    {
        $variantIds = $products->flatMap->variants->pluck('id');

        $latestPoItems = PurchaseOrderItem::whereIn('product_variant_id', $variantIds)
            ->orderBy('id', 'desc')
            ->get()
            ->unique('product_variant_id')
            ->keyBy('product_variant_id');

        $products->each(function ($product) use ($latestPoItems) {
            $latestItem = null;
            foreach ($product->variants as $variant) {
                if ($latestPoItems->has($variant->id)) {
                    $item = $latestPoItems->get($variant->id);
                    if (! $latestItem || $item->id > $latestItem->id) {
                        $latestItem = $item;
                    }
                }
            }

            if ($latestItem) {
                $product->base_cost = (float) $latestItem->original_cost;
                $product->retail_price = (float) $latestItem->retail_price;
            } else {
                // Fallback to original product values if no batches exist
                $product->base_cost = (float) $product->getOriginal('base_cost');
                $product->retail_price = (float) ($product->variants->first()?->retail_price ?: $product->getOriginal('retail_price'));
            }
        });

        return $products;
    }
}
