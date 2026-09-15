<?php

namespace App\Http\Controllers;

use App\Models\Shop;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StorefrontController extends Controller
{
    public function index(Shop $shop)
    {
        $categories = $shop->categories()->select('id', 'name')->get();

        $heroProductId = $shop->settings['featured_product_id'] ?? null;
        $heroProduct = null;
        if ($heroProductId) {
            $heroProduct = $shop->products()
                ->with(['media', 'variants.media', 'category:id,name'])
                ->where('is_active', true)
                ->find($heroProductId);
        }

        $featuredProducts = $shop->products()
            ->with(['media', 'variants.media', 'category:id,name'])
            ->where('is_active', true)
            ->latest()
            ->take(8)
            ->get();

        return Inertia::render('Storefront/Home', [
            'shop' => $shop->only('name', 'slug', 'settings'),
            'categories' => $categories,
            'featuredProducts' => $featuredProducts,
            'heroProduct' => $heroProduct ?: ($featuredProducts->first() ?? null),
        ]);
    }

    public function products(Shop $shop, Request $request)
    {
        $categories = $shop->categories()->select('id', 'name')->get();

        $query = $shop->products()
            ->with(['media', 'variants.media', 'category:id,name'])
            ->where('is_active', true);

        if ($request->filled('category')) {
            $query->where('category_id', $request->category);
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->get('sort') === 'price_asc') {
            $query->orderBy('retail_price', 'asc');
        } elseif ($request->get('sort') === 'price_desc') {
            $query->orderBy('retail_price', 'desc');
        } else {
            $query->latest();
        }

        $products = $query->paginate(12)->withQueryString();

        return Inertia::render('Storefront/Products', [
            'shop' => $shop->only('name', 'slug', 'settings'),
            'categories' => $categories,
            'products' => $products,
            'filters' => $request->only(['category', 'search', 'sort']),
        ]);
    }
}
