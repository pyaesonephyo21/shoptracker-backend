<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Services\StockAdjustmentService;

class StockAdjustmentController extends Controller
{
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
