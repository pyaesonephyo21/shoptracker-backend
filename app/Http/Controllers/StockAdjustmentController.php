<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StockAdjustmentRequest;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Services\StockAdjustmentService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StockAdjustmentController extends Controller
{
    public function index(Request $request): Response
    {
        $query = StockAdjustment::with(['productVariant.product', 'user']);

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $adjustments = $query->latest()->paginate(15)->withQueryString();

        return Inertia::render('Inventory/StockAdjustments', [
            'adjustments' => $adjustments,
            'filters' => [
                'start_date' => $request->start_date ?? '',
                'end_date' => $request->end_date ?? '',
            ],
        ]);
    }

    public function create(Product $product): Response
    {
        $product->load(['variants' => function ($q) {
            $q->withTrashed()->with(['batches' => function ($bq) {
                $bq->with('reference')->latest('created_at')->limit(20);
            }]);
        }]);

        return Inertia::render('Inventory/StockAdjustment', [
            'product' => $product,
        ]);
    }

    public function store(StockAdjustmentRequest $request, Product $product, StockAdjustmentService $service): RedirectResponse
    {
        $validated = $request->validated();

        $finalQuantity = $validated['action_type'] === 'remove' ? -$validated['quantity'] : $validated['quantity'];
        $batchPricingMode = $validated['batch_pricing_mode'] ?? 'default';
        $selectedBatchId = isset($validated['selected_batch_id']) && $validated['selected_batch_id'] !== ''
            ? (int) $validated['selected_batch_id']
            : null;
        $unitCost = isset($validated['unit_cost']) && $validated['unit_cost'] !== '' && $validated['unit_cost'] !== null
            ? (float) $validated['unit_cost']
            : null;
        $retailPrice = isset($validated['retail_price']) && $validated['retail_price'] !== '' && $validated['retail_price'] !== null
            ? (float) $validated['retail_price']
            : null;
        $updateVariantPrice = (bool) ($validated['update_variant_retail_price'] ?? false);

        try {
            $service->adjustStock(
                (int) $validated['product_variant_id'],
                (int) $finalQuantity,
                (string) $validated['reason'],
                $validated['note'] ?? null,
                $batchPricingMode,
                $selectedBatchId,
                $unitCost,
                $retailPrice,
                $updateVariantPrice
            );

            return redirect("/inventory/{$product->id}")->with('success', 'Stock adjusted successfully.');
        } catch (Exception $e) {
            return back()->withErrors(['quantity' => $e->getMessage()]);
        }
    }
}
