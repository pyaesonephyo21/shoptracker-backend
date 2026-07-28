<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use App\Models\Courier;
use App\Models\SalesOrder;
use App\Models\PaymentMethod;
use App\Services\SalesOrderService;

class CourierSettlementController extends Controller
{
    protected $salesOrderService;

    public function __construct(SalesOrderService $salesOrderService)
    {
        $this->salesOrderService = $salesOrderService;
    }

    public function index(Request $request)
    {
        $couriers = Courier::all();
        $paymentMethods = PaymentMethod::all();
        $selectedCourierId = $request->input('courier_id');
        
        if ($selectedCourierId && !$couriers->contains('id', $selectedCourierId)) {
            $selectedCourierId = null;
        }

        $unsettledOrders = [];
        if ($selectedCourierId) {
            $unsettledOrders = SalesOrder::where('courier_id', $selectedCourierId)
                ->where('money_collected_by', 'courier')
                ->where('status', 'delivered')
                ->where('settlement_status', 'unpaid')
                ->orderBy('created_at', 'asc')
                ->get()
                ->map(function ($order) {
                    return [
                        'id' => $order->id,
                        'date' => $order->created_at->format('M d, Y'),
                        'customer_name' => $order->customer_name,
                        'net_revenue' => (float)$order->net_revenue,
                        'paid_amount' => (float)$order->paid_amount,
                        'balance' => (float)($order->net_revenue - $order->paid_amount),
                    ];
                });
        }

        return Inertia::render('Sales/CourierSettlements', [
            'couriers' => $couriers,
            'paymentMethods' => $paymentMethods,
            'unsettledOrders' => $unsettledOrders,
            'selectedCourierId' => (int)$selectedCourierId,
        ]);
    }

    public function process(Request $request)
    {
        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'exists:sales_orders,id',
            'payment_method' => 'required|string',
        ]);

        $this->salesOrderService->batchSettle($validated['order_ids'], $validated['payment_method']);

        return redirect()->back()->with('success', count($validated['order_ids']) . ' orders successfully settled.');
    }
}
