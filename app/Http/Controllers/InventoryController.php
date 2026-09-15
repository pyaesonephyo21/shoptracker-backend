<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Models\SalesOrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->input('status', 'active');
        $query = Product::with(['category', 'variants.media', 'media'])
            ->withSum('variants', 'stock_quantity')
            ->withSum('variants', 'pending_stock')
            ->filter([
                'search' => $request->search,
                'type' => $request->type,
                'category_id' => $request->category_id,
                'status' => $status,
                'filter' => $request->filter,
            ]);

        $products = $query->latest()->paginate(15)->withQueryString();
        $categories = Category::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Inventory/InventoryList', [
            'products' => $products,
            'categories' => $categories,
            'filters' => [
                'search' => $request->search ?? '',
                'type' => $request->type ?? '',
                'filter' => $request->filter ?? '',
                'category_id' => $request->category_id ?? '',
                'status' => $status,
            ],
        ]);
    }

    public function show(Product $product)
    {
        $product->load(['category', 'media', 'variants' => function ($q) {
            $q->withTrashed();
        }, 'variants.media', 'variants.inventoryLogs' => function ($q) {
            $q->orderBy('created_at', 'desc')->with('reference');
        }, 'variants.batches' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }]);

        // Find the latest batch across all variants to get the latest cost
        $latestBatch = ProductBatch::whereIn('product_variant_id', $product->variants->pluck('id'))
            ->latest('created_at')
            ->first();

        $pendingCost = PurchaseOrderItem::whereIn('product_variant_id', $product->variants->pluck('id'))
            ->whereHas('purchaseOrder', function ($q) {
                $q->where('status', 'pending');
            })
            ->latest('created_at')
            ->value('unit_cost') ?? 0;

        $latestCost = $latestBatch ? $latestBatch->unit_cost : ($pendingCost > 0 ? $pendingCost : $product->base_cost);
        $latestRetailPrice = $latestBatch && $latestBatch->retail_price ? $latestBatch->retail_price : $product->retail_price;

        return Inertia::render('Inventory/ProductDetail', [
            'product' => $product,
            'latestCost' => (float) $latestCost,
            'latestRetailPrice' => (float) $latestRetailPrice,
            'pendingCost' => (float) $pendingCost,
        ]);
    }

    public function create()
    {
        $categories = Category::all();

        return Inertia::render('Inventory/AddProduct', [
            'categories' => $categories,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
            'base_cost' => 'nullable|numeric|min:0',
            'retail_price' => 'nullable|numeric|min:0',
            'variant_options' => 'nullable|array',
            'variants' => 'required|array|min:1',
            'variants.*.sku' => 'nullable|string|max:255|unique:product_variants,sku',
            'variants.*.attributes' => 'nullable|array',
            'variants.*.retail_price' => 'nullable|numeric|min:0',
            'variants.*.image' => 'nullable|image|max:5120',
            'image' => 'nullable|image|max:5120',
        ]);

        DB::transaction(function () use ($validated, $request) {
            $product = Product::create([
                'name' => $validated['name'],
                'category_id' => $validated['category_id'] ?? null,
                'type' => $validated['type'],
                'base_cost' => $validated['base_cost'] ?? 0,
                'retail_price' => $validated['retail_price'] ?? 0,
                'variant_options' => $validated['variant_options'] ?? null,
            ]);

            foreach ($validated['variants'] as $index => $v) {
                $variant = $product->variants()->create([
                    'sku' => $v['sku'] ?? null,
                    'attributes' => $v['attributes'] ?? null,
                    'retail_price' => $v['retail_price'] ?? null,
                ]);

                if ($request->hasFile("variants.{$index}.image")) {
                    $variant->addMedia($request->file("variants.{$index}.image"))->toMediaCollection('variants');
                }
            }

            if ($request->hasFile('image')) {
                $product->addMedia($request->file('image'))->toMediaCollection('products');
            }
        });

        return redirect('/inventory')->with('success', 'Product created successfully.');
    }

    public function edit(Product $product)
    {
        $product->load(['media', 'variants.media']);
        $categories = Category::all();

        return Inertia::render('Inventory/EditProduct', [
            'product' => $product,
            'categories' => $categories,
        ]);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
            'base_cost' => 'nullable|numeric|min:0',
            'retail_price' => 'nullable|numeric|min:0',
            'variant_options' => 'nullable|array',
            'variants' => 'required|array|min:1',
            'variants.*.id' => 'nullable|exists:product_variants,id',
            'variants.*.sku' => 'nullable|string|max:255',
            'variants.*.attributes' => 'nullable|array',
            'variants.*.retail_price' => 'nullable|numeric|min:0',
            'variants.*.image' => 'nullable|image|max:5120',
            'variants.*.remove_image' => 'nullable|boolean',
            'image' => 'nullable|image|max:5120',
            'remove_image' => 'nullable|boolean',
        ]);

        DB::transaction(function () use ($validated, $request, $product) {
            $product->update([
                'name' => $validated['name'],
                'category_id' => $validated['category_id'] ?? null,
                'type' => $validated['type'],
                'base_cost' => $validated['base_cost'] ?? 0,
                'retail_price' => $validated['retail_price'] ?? 0,
                'variant_options' => $validated['variant_options'] ?? null,
            ]);

            if ($request->boolean('remove_image')) {
                $product->clearMediaCollection('products');
            } elseif ($request->hasFile('image')) {
                $product->clearMediaCollection('products');
                $product->addMedia($request->file('image'))->toMediaCollection('products');
            }

            $existingVariantIds = [];
            foreach ($validated['variants'] as $index => $v) {
                if (isset($v['id'])) {
                    $variant = $product->variants()->find($v['id']);
                    if ($variant) {
                        $variant->update([
                            'sku' => $v['sku'] ?? null,
                            'attributes' => $v['attributes'] ?? null,
                            'retail_price' => $v['retail_price'] ?? null,
                        ]);

                        if (!empty($v['remove_image'])) {
                            $variant->clearMediaCollection('variants');
                        } elseif ($request->hasFile("variants.{$index}.image")) {
                            $variant->clearMediaCollection('variants');
                            $variant->addMedia($request->file("variants.{$index}.image"))->toMediaCollection('variants');
                        }

                        $existingVariantIds[] = $variant->id;
                    }
                } else {
                    $newVariant = $product->variants()->create([
                        'sku' => $v['sku'] ?? null,
                        'attributes' => $v['attributes'] ?? null,
                        'retail_price' => $v['retail_price'] ?? null,
                    ]);

                    if ($request->hasFile("variants.{$index}.image")) {
                        $newVariant->addMedia($request->file("variants.{$index}.image"))->toMediaCollection('variants');
                    }

                    $existingVariantIds[] = $newVariant->id;
                }
            }

            // Delete variants that were removed from the UI (Soft Delete)
            $product->variants()->whereNotIn('id', $existingVariantIds)->delete();
        });

        return redirect("/inventory/{$product->id}")->with('success', 'Product updated successfully.');
    }

    public function destroy(Product $product)
    {
        $variantIds = $product->variants->pluck('id');
        $hasPO = PurchaseOrderItem::whereIn('product_variant_id', $variantIds)->exists();
        $hasSO = SalesOrderItem::whereIn('product_variant_id', $variantIds)->exists();
        $hasBatches = ProductBatch::whereIn('product_variant_id', $variantIds)->exists();

        if ($hasPO || $hasSO || $hasBatches) {
            return back()->withErrors(['error' => 'Cannot delete product because it has associated orders or stock history.']);
        }

        $product->delete();

        return redirect('/inventory')->with('success', 'Product deleted successfully.');
    }

    public function toggleActive(Product $product)
    {
        $product->update([
            'is_active' => ! $product->is_active,
        ]);

        $statusMessage = $product->is_active ? 'restored' : 'archived';

        return back()->with('success', "Product {$statusMessage} successfully.");
    }

    public function restoreVariant($id)
    {
        $variant = ProductVariant::withTrashed()->findOrFail($id);
        $variant->restore();

        return back()->with('success', 'Variant restored successfully.');
    }

    public function updateRetailPrice(Request $request, ProductVariant $variant)
    {
        $validated = $request->validate([
            'retail_price' => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($variant, $validated) {
            $retailPrice = $validated['retail_price'];

            $variant->update(['retail_price' => $retailPrice]);
            $variant->batches()->update(['retail_price' => $retailPrice]);
            $variant->purchaseOrderItems()->update(['retail_price' => $retailPrice]);
        });

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return back()->with('success', 'Retail price updated successfully.');
    }
}
