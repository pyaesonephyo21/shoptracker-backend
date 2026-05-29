<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Models\Product;
use App\Models\Category;

class InventoryController extends Controller
{
    public function index(\Illuminate\Http\Request $request)
    {
        $query = Product::with('category');

        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($request->has('type') && $request->type !== '') {
            $query->where('type', $request->type);
        }

        if ($request->has('filter') && $request->filter === 'low_stock') {
            $query->where('stock_quantity', '<=', 5);
        }

        $products = $query->latest()->paginate(15)->withQueryString();

        return Inertia::render('Inventory/InventoryList', [
            'products' => $products,
            'filters' => [
                'search' => $request->search ?? '',
                'type' => $request->type ?? '',
                'filter' => $request->filter ?? '',
            ]
        ]);
    }

    public function show($id)
    {
        $product = Product::with(['inventoryLogs' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }, 'batches' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }])->findOrFail($id);

        $latestBatch = $product->batches->first();
        $latestCost = $latestBatch ? $latestBatch->unit_cost : $product->base_cost;
        $latestRetailPrice = $latestBatch && $latestBatch->retail_price ? $latestBatch->retail_price : $product->retail_price;

        $pendingCost = \App\Models\PurchaseOrderItem::where('product_id', $id)
            ->whereHas('purchaseOrder', function ($q) {
                $q->where('status', 'pending');
            })
            ->latest('created_at')
            ->value('unit_cost') ?? 0;

        return Inertia::render('Inventory/ProductDetail', [
            'product' => $product,
            'latestCost' => (float)$latestCost,
            'latestRetailPrice' => (float)$latestRetailPrice,
            'pendingCost' => (float)$pendingCost
        ]);
    }

    public function create()
    {
        $categories = Category::all();
        return Inertia::render('Inventory/AddProduct', [
            'categories' => $categories
        ]);
    }

    public function store(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:255|unique:products,sku',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
        ]);

        $validated['base_cost'] = 0;
        $validated['retail_price'] = 0;

        Product::create($validated);

        return redirect('/inventory')->with('success', 'Product created successfully.');
    }

    public function edit($id)
    {
        $product = Product::findOrFail($id);
        $categories = Category::all();

        return Inertia::render('Inventory/EditProduct', [
            'product' => $product,
            'categories' => $categories
        ]);
    }

    public function update(\Illuminate\Http\Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:255|unique:products,sku,' . $id,
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
        ]);

        $product->update($validated);

        return redirect("/inventory/{$id}")->with('success', 'Product updated successfully.');
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);

        $hasPO = \App\Models\PurchaseOrderItem::where('product_id', $id)->exists();
        $hasSO = \App\Models\SalesOrderItem::where('product_id', $id)->exists();
        $hasBatches = \App\Models\ProductBatch::where('product_id', $id)->exists();

        if ($hasPO || $hasSO || $hasBatches) {
            return back()->withErrors(['error' => 'Cannot delete product because it has associated orders or stock history.']);
        }

        $product->delete();

        return redirect('/inventory')->with('success', 'Product deleted successfully.');
    }
}
