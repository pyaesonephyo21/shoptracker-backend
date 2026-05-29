<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\SalesOrder;
use App\Models\Product;
use App\Models\Courier;
use App\Services\SalesOrderService;

class SalesOrderController extends Controller
{
    protected $service;

    public function __construct(SalesOrderService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $query = SalesOrder::with(['items']);
        if ($request->has('status') && $request->status !== '')
            $query->where('status', $request->status);


        if ($request->has('settlement_status') && $request->settlement_status !== '') {
            $query->where('payment_status', $request->settlement_status);
        }

        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%");
            });
        }

        $paginatedOrders = $query->latest()->paginate(15)->withQueryString();

        $paginatedOrders->getCollection()->transform(function ($order) {
            // Map the data structure to what SalesList.tsx expects
            return [
                'id' => $order->id,
                'status' => $order->status,
                'is_preorder' => (bool)$order->is_preorder,
                'date' => $order->created_at->format('Y-m-d'),
                'customer' => ['name' => $order->customer_name],
                'financials' => [
                    'payment_status' => $order->payment_status,
                    'paid_amount' => $order->paid_amount,
                    'grand_total' => $order->customer_grand_total,
                ]
            ];
        });

        return Inertia::render('Sales/SalesList', [
            'orders' => $paginatedOrders,
            'filters' => [
                'status' => $request->status ?? '',
                'settlement_status' => $request->settlement_status ?? '',
                'search' => $request->search ?? '',
            ]
        ]);
    }

    public function create()
    {
        $products = Product::with(['batches' => function ($q) {
            $q->where('remaining_quantity', '>', 0)->orderBy('created_at', 'asc');
        }])->whereRaw('(stock_quantity + pending_stock) > 0')->get();
        return Inertia::render('Sales/AddSale', ['products' => $products]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string',
            'customer_phone' => 'nullable|string',
            'address' => 'nullable|string',
            'cart' => 'required|array|min:1',
            'cart.*.product_id' => 'required|exists:products,id',
            'cart.*.quantity' => 'required|integer|min:1',
            'cart.*.discount_type' => 'nullable|in:none,fixed,percent',
            'cart.*.discount_value' => 'nullable|numeric|min:0',
            'cart.*.discount_reason' => 'nullable|string',
            'discount_type' => 'nullable|in:none,fixed,percent',
            'discount_value' => 'nullable|numeric|min:0',
            'discount_reason' => 'nullable|string',
            'note' => 'nullable|string',
            'paid_amount' => 'nullable|numeric|min:0',
            'overcharge' => 'nullable|numeric|min:0',
        ]);

        // Map frontend structure to what the service expects
        $orderData = [
            'customer_name' => $validated['customer_name'] ?? 'Walk-in',
            'customer_phone' => $validated['customer_phone'] ?? '',
            'delivery_address' => $validated['address'] ?? '',
            'discount_type' => $validated['discount_type'] ?? 'none',
            'discount_value' => $validated['discount_value'] ?? 0,
            'discount_reason' => $validated['discount_reason'] ?? '',
            'note' => $validated['note'] ?? '',
            'paid_amount' => $validated['paid_amount'] ?? 0,
            'overcharge' => $validated['overcharge'] ?? 0,
        ];

        $this->service->createOrder($orderData, $validated['cart']);

        return redirect('/sales')->with('success', 'Sale recorded successfully.');
    }

    public function show($id)
    {
        $orderModel = SalesOrder::with(['items.product', 'courier'])->findOrFail($id);

        // Map to what SalesDetail.tsx expects
        $order = [
            'id' => $orderModel->id,
            'status' => $orderModel->status,
            'is_preorder' => (bool)$orderModel->is_preorder,
            'date' => $orderModel->created_at->format('Y-m-d'),
            'customer' => [
                'name' => $orderModel->customer_name,
                'phone' => $orderModel->customer_phone,
                'address' => $orderModel->delivery_address,
            ],
            'financials' => [
                'subtotal' => (float)$orderModel->subtotal,
                'discount' => (float)$orderModel->discount_total,
                'discount_type' => $orderModel->discount_type,
                'discount_value' => (float)$orderModel->discount_value,
                'discount_reason' => $orderModel->discount_reason,
                'paid_amount' => (float)$orderModel->paid_amount,
                'balance' => (float)($orderModel->customer_grand_total - $orderModel->paid_amount),
                'payment_status' => $orderModel->payment_status,
                'grand_total' => (float)$orderModel->customer_grand_total,
                'net_revenue' => (float)$orderModel->net_revenue,
                'total_cost' => (float)$orderModel->total_cost,
                'return_cost' => (float)$orderModel->return_cost,
                'profit' => (float)$orderModel->net_profit,
                'overcharge' => (float)$orderModel->overcharge,
            ],
            'delivery' => [
                'courier_name' => $orderModel->courier ? $orderModel->courier->name : ($orderModel->courier_id ? 'Unknown Courier' : 'None'),
                'tracking' => $orderModel->tracking_number,
                'fee' => (float)$orderModel->delivery_fee,
                'courier_service_fee' => (float)$orderModel->courier_service_fee,
                'is_prepaid' => (bool)$orderModel->is_deli_prepaid,
                'collected_by' => $orderModel->money_collected_by,
                'settlement_status' => $orderModel->settlement_status,
            ],
            'items' => collect($orderModel->items)->map(function ($item) {
                return [
                    'id' => $item->id,
                    'product_name' => $item->product ? $item->product->name : 'Unknown Product',
                    'quantity' => $item->quantity,
                    'price' => (float)$item->unit_price,
                    'total' => (float)$item->line_total,
                    'discount_value' => (float)$item->discount_value,
                    'discount_type' => $item->discount_type,
                    'discount_reason' => $item->discount_reason,
                ];
            }),
            'note' => $orderModel->note,
            'audit_log' => $orderModel->audit_log ?? [],
        ];

        return Inertia::render('Sales/SalesDetail', ['order' => $order]);
    }

    public function edit($id)
    {
        $orderModel = SalesOrder::with(['items.product'])->findOrFail($id);

        if (!in_array($orderModel->status, ['pending', 'delivery_added'])) {
            return redirect("/sales/{$id}")->with('error', 'Only pending or delivery added orders can be edited.');
        }

        // We can just pass the same payload structure as 'show' or the raw model, 
        // since we are writing a specific EditSale component.
        return Inertia::render('Sales/EditSale', [
            'order' => $orderModel->load('items.product'),
            'couriers' => Courier::all()
        ]);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string',
            'customer_phone' => 'nullable|string',
            'delivery_address' => 'nullable|string',
            'discount_type' => 'nullable|in:none,fixed,percent',
            'discount_value' => 'nullable|numeric|min:0',
            'discount_reason' => 'nullable|string',
            'note' => 'nullable|string',
            'paid_amount' => 'nullable|numeric|min:0',
            'overcharge' => 'nullable|numeric|min:0',
            'courier_id' => 'nullable|exists:couriers,id',
            'tracking_number' => 'nullable|string',
            'delivery_fee' => 'nullable|numeric|min:0',
            'courier_service_fee' => 'nullable|numeric|min:0',
        ]);

        $this->service->updateOrder($id, $validated);

        return redirect("/sales/{$id}")->with('success', 'Order updated successfully.');
    }

    public function fulfillView($id)
    {
        $order = SalesOrder::findOrFail($id);
        $couriers = Courier::all();

        return Inertia::render('Sales/FulfillOrder', [
            'order' => ['id' => $order->id],
            'couriers' => $couriers
        ]);
    }

    public function fulfillStore(Request $request, $id)
    {
        $validated = $request->validate([
            'courier_id' => 'required|exists:couriers,id',
            'tracking_number' => 'nullable|string',
            'delivery_fee' => 'nullable|numeric|min:0',
            'courier_service_fee' => 'nullable|numeric|min:0',
            'delivery_note' => 'nullable|string',
            'money_collected_by' => 'required|in:seller,courier',
            'is_deli_prepaid' => 'boolean',
        ]);

        $this->service->fulfillOrder($id, $validated);

        return redirect("/sales/{$id}")->with('success', 'Order fulfillment arranged.');
    }

    public function markDelivered($id)
    {
        $this->service->markAsDelivered($id);
        return redirect("/sales/{$id}")->with('success', 'Order marked as delivered.');
    }

    public function settle(Request $request, $id)
    {
        $validated = $request->validate([
            'payment_method' => 'required|string'
        ]);

        $this->service->settle($id, $validated['payment_method']);
        return redirect("/sales/{$id}")->with('success', 'Order settled and money collected.');
    }

    public function returnItem(Request $request, $id, $itemId)
    {
        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:255',
        ]);

        $this->service->returnItem($id, $itemId, $validated['quantity'], $validated['reason']);

        return redirect("/sales/{$id}")->with('success', 'Item returned successfully.');
    }

    public function cancel(Request $request, $id)
    {
        $validated = $request->validate([
            'cancel_reason' => 'nullable|string|max:255'
        ]);
        $this->service->cancelOrder($id, $validated['cancel_reason'] ?: 'Manual Cancellation');
        return back()->with('success', 'Order cancelled successfully.');
    }
}
