<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Services\StockAdjustmentService;

class StockAdjustmentController extends Controller
{
    public function create($id)
    {
        $product = Product::findOrFail($id);
        return Inertia::render('Inventory/StockAdjustment', [
            'product' => $product
        ]);
    }

    public function store(Request $request, $id, StockAdjustmentService $service)
    {
        $validated = $request->validate([
            'quantity' => 'required|integer|not_in:0',
            'reason' => 'required|string',
            'note' => 'nullable|string'
        ]);

        try {
            $service->adjustStock(
                $id,
                $validated['quantity'],
                $validated['reason'],
                $validated['note']
            );

            return redirect("/inventory/{$id}")->with('success', 'Stock adjusted successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['quantity' => $e->getMessage()]);
        }
    }
}
