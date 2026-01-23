<?php

namespace App\Http\Controllers\Api;

use App\Services\SalesOrderService;
use App\Http\Controllers\Controller;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use App\Http\Resources\SalesOrderResource;
use App\Http\Requests\StoreSalesOrderRequest;
use Illuminate\Http\Request;
use App\Models\SalesOrder;

class SalesOrderController extends Controller
{
    public function __construct(protected SalesOrderService $service) {}

    public function index()
    {
        $orders = QueryBuilder::for(SalesOrder::class)
            ->allowedFilters([
                'customer_name',
                'status',
                'payment_method'
            ])
            ->allowedSorts(['created_at', 'grand_total'])
            ->defaultSort('-created_at')
            ->paginate(20);

        return SalesOrderResource::collection($orders);
    }

    public function store(StoreSalesOrderRequest $request)
    {
        // Now much simpler - only basic info needed
        $order = $this->service->createOrder(
            $request->validated(),
            $request->items
        );
        return new SalesOrderResource($order);
    }

    public function show($id)
    {
        $order = SalesOrder::with(['items.product', 'courier'])->findOrFail($id);
        return new SalesOrderResource($order);
    }

    // --- NEW: Fulfill / Arrange Delivery ---
    public function fulfill(Request $request, $id)
    {
        $data = $request->validate([
            'courier_id' => 'required|exists:couriers,id',
            'delivery_fee' => 'required|numeric|min:0',
            'courier_service_fee' => 'nullable|numeric|min:0',
            'tracking_number' => 'nullable|string',
            'delivery_note' => 'nullable|string',
            'money_collected_by' => 'required|in:seller,courier',
            'is_deli_prepaid' => 'boolean'
        ]);

        $order = $this->service->fulfillOrder($id, $data);
        return new SalesOrderResource($order);
    }

    // --- NEW: Add Item to Existing Order ---
    public function addItem(Request $request, $id)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'nullable|numeric'
        ]);

        $order = $this->service->addItemToOrder(
            $id,
            $request->product_id,
            $request->quantity,
            $request->unit_price
        );
        return new SalesOrderResource($order);
    }

    // --- RESTORED: Standard Update (Info/Fees) ---
    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'customer_name' => 'nullable|string',
            'customer_phone' => 'nullable|string',
            'delivery_address' => 'nullable|string',
            'note' => 'nullable|string',
            'tracking_number' => 'nullable|string',
            // Allow updating fees if mistakes happen
            'delivery_fee' => 'nullable|numeric|min:0',
            'discount_value' => 'nullable|numeric|min:0',
            'discount_reason' => 'nullable|string',
        ]);

        $order = $this->service->updateOrder($id, $data);
        return new SalesOrderResource($order);
    }

    // --- RESTORED: Settlement & Cancellation ---

    public function settle($id, Request $request)
    {
        $paymentMethod = $request->validate([
            'payment_method' => 'nullable'
        ]);

        try {
            $this->service->settle($id, $paymentMethod);
            return response()->json(['message' => 'Settled successfully']);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    public function cancel(Request $request, $id)
    {
        $request->validate(['reason' => 'nullable|string']);
        try {
            $order = $this->service->cancelOrder($id, $request->input('reason', 'Manual Cancellation'));
            return new SalesOrderResource($order);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    public function returnItem(Request $request, $id)
    {
        $request->validate([
            'item_id' => 'required|integer',
            'quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string'
        ]);

        try {
            $order = $this->service->returnItem(
                $id,
                $request->item_id,
                $request->quantity,
                $request->input('reason', 'Customer Return')
            );
            return new SalesOrderResource($order);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
