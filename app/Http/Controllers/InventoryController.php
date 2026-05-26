<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Product;
use App\Models\Category;

class InventoryController extends Controller
{
    public function index()
    {
        $products = Product::with('category')->latest()->get();
        return Inertia::render('Inventory/InventoryList', [
            'products' => $products
        ]);
    }

    public function show($id)
    {
        $product = Product::with('inventoryLogs')->findOrFail($id);
        return Inertia::render('Inventory/ProductDetail', [
            'product' => $product
        ]);
    }

    public function create()
    {
        $categories = Category::all();
        return Inertia::render('Inventory/AddProduct', [
            'categories' => $categories,
            'isForeignMode' => true // Should come from shop settings
        ]);
    }

    public function store(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:255|unique:products,sku',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
            'base_cost' => 'required|numeric|min:0',
            'retail_price' => 'required|numeric|min:0',
        ]);

        Product::create($validated);

        return redirect('/inventory')->with('success', 'Product created successfully.');
    }
}
