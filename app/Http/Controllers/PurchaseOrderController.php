<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::with(['supplier']);

        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('batch_name', 'like', "%{$search}%")
                  ->orWhere('shop_name', 'like', "%{$search}%")
                  ->orWhereHas('supplier', function($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->has('status') && $request->status !== '') {
            $query->where('status', $request->status);
        }

        if ($request->has('payment_status') && $request->payment_status !== '') {
            $query->where('payment_status', $request->payment_status);
        }

        $orders = $query->latest()->paginate(15)->withQueryString();

        return Inertia::render('Inventory/PurchaseOrderList', [
            'orders' => $orders,
            'filters' => [
                'search' => $request->search ?? '',
                'status' => $request->status ?? '',
                'payment_status' => $request->payment_status ?? '',
            ]
        ]);
    }

    public function create()
    {
        $products = Product::all();
        $suppliers = Supplier::all();

        return Inertia::render('Inventory/AddPurchaseOrder', [
            'products' => $products,
            'suppliers' => $suppliers,
            'currencyLabel' => 'CNY',
            'isForeignOrder' => true
        ]);
    }

    public function store(Request $request, PurchaseOrderService $service)
    {
        $validated = $request->validate([
            'order_type' => 'required|in:local,global',
            'batch_name' => 'required|string',
            'supplier_id' => 'required_if:order_type,global|nullable|exists:suppliers,id',
            'shop_name' => 'nullable|string',
            'exchange_rate' => 'required_if:order_type,global|nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.retail_price' => 'nullable|numeric|min:0',
            'supplier_fee' => 'nullable|numeric|min:0',
            'paid_amount' => 'nullable|numeric|min:0',
            'note' => 'nullable|string'
        ]);

        $po = $service->createOrder($validated);

        return redirect('/inventory/purchase-orders')->with('success', 'Purchase order created successfully.');
    }

    public function show($id)
    {
        $order = PurchaseOrder::with(['items.product', 'supplier'])->findOrFail($id);
        
        // If order arrived, fetch associated batches to get the retail price that was set
        $batches = collect();
        if ($order->status === 'arrived') {
            $batches = \App\Models\ProductBatch::where('reference_type', PurchaseOrder::class)
                ->where('reference_id', $order->id)
                ->get()
                ->keyBy('product_id');
        }

        foreach ($order->items as $item) {
            if ($order->status === 'arrived' && $batches->has($item->product_id)) {
                $item->batch_retail_price = $batches->get($item->product_id)->retail_price;
            }

            // Fetch pricing history
            $historicalBatches = \App\Models\ProductBatch::where('product_id', $item->product_id)
                ->whereNotNull('retail_price')
                ->latest('created_at')
                ->take(3)
                ->get();

            $item->latest_retail_price = $historicalBatches->first()?->retail_price;
            $item->previous_retail_prices = $historicalBatches->slice(1, 2)->pluck('retail_price')->toArray();

            // Fetch pending retail price from other pending POs
            $pendingItem = \App\Models\PurchaseOrderItem::where('product_id', $item->product_id)
                ->whereHas('purchaseOrder', function($q) {
                    $q->where('status', 'pending');
                })
                ->whereNotNull('retail_price')
                ->where('purchase_order_id', '!=', $order->id)
                ->latest('created_at')
                ->first();

            $item->pending_retail_price = $pendingItem ? $pendingItem->retail_price : null;
        }

        // Add audit_log handling if needed specifically, but the model has it natively now.
        $order->audit_log = $order->audit_log ?? [];

        return Inertia::render('Inventory/PurchaseOrderDetail', [
            'order' => $order
        ]);
    }

    public function edit($id)
    {
        $order = PurchaseOrder::with('items.product')->findOrFail($id);

        if ($order->status !== 'pending') {
            return redirect("/inventory/purchase-orders/{$id}")->with('error', 'Only pending purchase orders can be edited.');
        }

        $products = Product::all();
        $suppliers = Supplier::all();

        return Inertia::render('Inventory/EditPurchaseOrder', [
            'order' => $order,
            'products' => $products,
            'suppliers' => $suppliers,
            'currencyLabel' => 'CNY',
            'isForeignOrder' => true
        ]);
    }

    public function update(Request $request, $id, PurchaseOrderService $service)
    {
        $validated = $request->validate([
            'order_type' => 'required|in:local,global',
            'batch_name' => 'nullable|string',
            'supplier_id' => 'required_if:order_type,global|nullable|exists:suppliers,id',
            'shop_name' => 'nullable|string',
            'exchange_rate' => 'required_if:order_type,global|nullable|numeric|min:1',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.retail_price' => 'nullable|numeric|min:0',
            'supplier_fee' => 'nullable|numeric|min:0',
            'paid_amount' => 'nullable|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        try {
            $service->updateOrder($id, $validated);
            return redirect("/inventory/purchase-orders/{$id}")->with('success', 'Purchase order updated successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    // Assuming we need a method for arriving the PO.
    // Wait, the frontend PurchaseOrderDetail might not have an "Arrive" button yet, or it's a POST to `/inventory/purchase-orders/{id}/arrive`
    public function markAsArrived(Request $request, $id, PurchaseOrderService $service)
    {
        $po = PurchaseOrder::findOrFail($id);

        $validated = $request->validate([
            'cargo_fee' => 'nullable|numeric|min:0',
            'local_deli_fee' => 'nullable|numeric|min:0',
            'adjustment_amount' => 'nullable|numeric',
            'adjustment_reason' => 'nullable|string|required_with:adjustment_amount',
            'received_items' => 'required|array',
            'received_items.*.id' => 'required|exists:purchase_order_items,id',
            'received_items.*.received_quantity' => 'nullable|integer|min:0',
            'received_items.*.retail_price' => 'nullable|numeric|min:0',
        ]);

        try {
            $service->markAsArrived($po, $validated);
            return back()->with('success', 'Purchase order marked as arrived.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function cancel(Request $request, $id, PurchaseOrderService $service)
    {
        $validated = $request->validate([
            'cancel_reason' => 'nullable|string|max:255'
        ]);

        try {
            $po = PurchaseOrder::findOrFail($id);
            $service->cancelOrder($po, $validated['cancel_reason'] ?: 'Manual Cancellation');
            return back()->with('success', 'Purchase order cancelled successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
