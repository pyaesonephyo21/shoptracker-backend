<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Services\PurchaseOrderService;
use App\Http\Resources\PurchaseOrderResource;
use App\Repositories\PurchaseOrderRepository;
use App\Http\Requests\StorePurchaseOrderRequest;

class PurchaseOrderController extends Controller
{
    public function __construct(
        protected PurchaseOrderService $poService,
        protected PurchaseOrderRepository $poRepo
    ) {}

    public function index(Request $request)
    {
        $orders = $this->poRepo->getAll($request->all());
        return PurchaseOrderResource::collection($orders);
    }

    public function store(StorePurchaseOrderRequest $request)
    {
        // 1. Get all safe, validated data
        $data = $request->validated();

        // 2. Separate Items from the main PO data
        // We use 'collect' to pull items out, leaving the rest for the PO
        $items = $data['items'];

        $poData = collect($data)->except('items')->toArray();

        // 3. Call Service
        $po = $this->poService->createBatch($poData, $items);

        return new PurchaseOrderResource($po);
    }

    public function show($id)
    {
        $po = $this->poRepo->findById($id);
        $po->load(['items.product']);

        return new PurchaseOrderResource($po);
    }

    // The Custom Action: "Arrived"
    public function markArrived(Request $request, $id)
    {
        $data = $request->validate([
            'cargo_fee' => 'nullable|numeric|min:0',
            'local_deli_fee' => 'nullable|numeric|min:0',
            'add_payment_amount' => 'nullable|numeric|min:0' // <--- New Field
        ]);

        try {
            $po = $this->poService->markAsArrived($id, $data);
            return response()->json(['message' => 'Batch arrived and updated!', 'data' => $po]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
