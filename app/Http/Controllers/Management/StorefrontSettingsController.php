<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class StorefrontSettingsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $shop = Shop::findOrFail($user->shop_id);

        $products = $shop->products()
            ->with(['media', 'variants.media', 'category:id,name'])
            ->where('is_active', true)
            ->latest()
            ->get(['id', 'name', 'retail_price', 'category_id']);

        return Inertia::render('Management/StorefrontSettings', [
            'shop' => $shop,
            'products' => $products,
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $shop = Shop::findOrFail($user->shop_id);

        if ($request->filled('slug')) {
            $request->merge(['slug' => Str::slug($request->slug)]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|alpha_dash|unique:shops,slug,' . $shop->id,
            'currency_code' => 'nullable|string|max:10',
            'settings' => 'nullable|array',
            'settings.announcement' => 'nullable|string|max:255',
            'settings.hero_subtitle' => 'nullable|string|max:255',
            'settings.hero_title' => 'nullable|string|max:255',
            'settings.hero_cta_text' => 'nullable|string|max:100',
            'settings.featured_product_id' => 'nullable|integer',
            'settings.theme' => 'nullable|array',
            'settings.theme.preset' => 'nullable|string',
            'settings.theme.background_color' => 'nullable|string|max:50',
            'settings.theme.text_color' => 'nullable|string|max:50',
            'settings.theme.accent_color' => 'nullable|string|max:50',
            'settings.theme.card_bg' => 'nullable|string|max:50',
        ]);

        $shop->update([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'currency_code' => $validated['currency_code'] ?? $shop->currency_code ?? 'MMK',
            'settings' => array_merge($shop->settings ?? [], $validated['settings'] ?? []),
        ]);

        return back()->with('success', 'Storefront settings updated successfully.');
    }
}
