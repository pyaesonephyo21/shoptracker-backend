<?php

namespace App\Http\Controllers\Management;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ShopController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeSuperAdmin($request->user());

        $shops = Shop::withCount(['users', 'products'])->latest()->get();

        return Inertia::render('Management/Shops', [
            'shops' => $shops,
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeSuperAdmin($request->user());

        if ($request->filled('slug')) {
            $request->merge(['slug' => Str::slug($request->slug)]);
        } else {
            $request->merge(['slug' => Str::slug($request->name)]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|alpha_dash|unique:shops,slug',
            'currency_code' => 'nullable|string|max:10',
            'settings' => 'nullable|array',
            'settings.hero_title' => 'nullable|string|max:255',
            'settings.hero_subtitle' => 'nullable|string|max:255',
            'settings.hero_cta_text' => 'nullable|string|max:100',
            'settings.announcement' => 'nullable|string|max:255',
            'settings.hero_image_desktop' => 'nullable|string|max:1000',
            'settings.hero_image_mobile' => 'nullable|string|max:1000',
        ]);

        Shop::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'currency_code' => $validated['currency_code'] ?? 'MMK',
            'settings' => $validated['settings'] ?? null,
        ]);

        return back()->with('success', 'Shop created successfully.');
    }

    public function update(Request $request, Shop $shop)
    {
        $this->authorizeSuperAdmin($request->user());

        if ($request->filled('slug')) {
            $request->merge(['slug' => Str::slug($request->slug)]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|alpha_dash|unique:shops,slug,' . $shop->id,
            'currency_code' => 'nullable|string|max:10',
            'settings' => 'nullable|array',
            'settings.hero_title' => 'nullable|string|max:255',
            'settings.hero_subtitle' => 'nullable|string|max:255',
            'settings.hero_cta_text' => 'nullable|string|max:100',
            'settings.announcement' => 'nullable|string|max:255',
            'settings.hero_image_desktop' => 'nullable|string|max:1000',
            'settings.hero_image_mobile' => 'nullable|string|max:1000',
        ]);

        $shop->update([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'currency_code' => $validated['currency_code'] ?? $shop->currency_code ?? 'MMK',
            'settings' => array_merge($shop->settings ?? [], $validated['settings'] ?? []),
        ]);

        return back()->with('success', 'Shop updated successfully.');
    }

    public function destroy(Request $request, Shop $shop)
    {
        $this->authorizeSuperAdmin($request->user());

        if (Shop::count() <= 1) {
            return back()->with('error', 'Cannot delete the only remaining shop.');
        }

        $shop->delete();

        return back()->with('success', 'Shop deleted successfully.');
    }

    private function authorizeSuperAdmin($user)
    {
        if (!$user || !$user->hasRole('superadmin')) {
            abort(403, 'Unauthorized. Super Admin access required.');
        }
    }
}
