<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Services\StockAdjustmentService;

class StockAdjustmentController extends Controller
{
    public function index(Request $request)
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
            ]
        ]);
    }
    public function create(Product $product)
    {
        $product->load(['variants' => function ($q) {
            $q->withTrashed();
        }]);
        return Inertia::render('Inventory/StockAdjustment', [
            'product' => $product
        ]);
    }

    public function store(Request $request, Product $product, StockAdjustmentService $service)
    {
        $validated = $request->validate([
            'product_variant_id' => 'required|exists:product_variants,id',
            'quantity' => 'required|integer|min:1',
            'action_type' => 'required|in:add,remove',
            'reason' => 'required|string',
            'note' => 'nullable|string'
        ]);

        $finalQuantity = $validated['action_type'] === 'remove' ? -$validated['quantity'] : $validated['quantity'];

        try {
            $service->adjustStock(
                $validated['product_variant_id'],
                $finalQuantity,
                $validated['reason'],
                $validated['note']
            );

            return redirect("/inventory/{$product->id}")->with('success', 'Stock adjusted successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['quantity' => $e->getMessage()]);
        }
    }
}
