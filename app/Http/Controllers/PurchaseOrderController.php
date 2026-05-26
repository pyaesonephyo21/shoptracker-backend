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
    public function index()
    {
        $orders = PurchaseOrder::with(['supplier'])->latest()->get();
        return Inertia::render('Inventory/PurchaseOrderList', [
            'orders' => $orders
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
            'batch_name' => 'required|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'shop_name' => 'nullable|string',
            'exchange_rate' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
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
        return Inertia::render('Inventory/PurchaseOrderDetail', [
            'order' => $order
        ]);
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
        ]);

        try {
            $service->markAsArrived($po, $validated);
            return back()->with('success', 'Purchase order marked as arrived.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }
}
