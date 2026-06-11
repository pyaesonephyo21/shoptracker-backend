<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Models\Product;
use App\Models\Category;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Models\SalesOrderItem;

class InventoryController extends Controller
{
    public function index(\Illuminate\Http\Request $request)
    {
        $query = Product::with(['category', 'variants'])
            ->withSum('variants', 'stock_quantity')
            ->withSum('variants', 'pending_stock');

        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('variants', function ($vq) use ($search) {
                        $vq->where('sku', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->has('type') && $request->type !== '') {
            $query->where('type', $request->type);
        }

        $status = $request->input('status', 'active');
        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'archived') {
            $query->where('is_active', false);
        }

        if ($request->has('filter') && $request->filter === 'low_stock') {
            $query->where(function ($q) {
                $q->selectRaw('coalesce(sum(stock_quantity), 0)')
                  ->from('product_variants')
                  ->whereColumn('product_variants.product_id', 'products.id')
                  ->whereNull('product_variants.deleted_at');
            }, '<=', 5);
        }
        $products = $query->latest()->paginate(15)->withQueryString();

        return Inertia::render('Inventory/InventoryList', [
            'products' => $products,
            'filters' => [
                'search' => $request->search ?? '',
                'type' => $request->type ?? '',
                'filter' => $request->filter ?? '',
                'status' => $status,
            ]
        ]);
    }

    public function show(Product $product)
    {
        $product->load(['category', 'variants' => function ($q) {
            $q->withTrashed();
        }, 'variants.inventoryLogs' => function ($q) {
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
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
            'base_cost' => 'nullable|numeric|min:0',
            'retail_price' => 'nullable|numeric|min:0',
            'variant_options' => 'nullable|array',
            'variants' => 'required|array|min:1',
            'variants.*.sku' => 'nullable|string|max:255|unique:product_variants,sku',
            'variants.*.attributes' => 'nullable|array',
            'variants.*.retail_price' => 'nullable|numeric|min:0',
        ]);

        DB::transaction(function () use ($validated) {
            $product = Product::create([
                'name' => $validated['name'],
                'category_id' => $validated['category_id'] ?? null,
                'type' => $validated['type'],
                'base_cost' => $validated['base_cost'] ?? 0,
                'retail_price' => $validated['retail_price'] ?? 0,
                'variant_options' => $validated['variant_options'] ?? null,
            ]);

            foreach ($validated['variants'] as $v) {
                $product->variants()->create([
                    'sku' => $v['sku'] ?? null,
                    'attributes' => $v['attributes'] ?? null,
                    'retail_price' => $v['retail_price'] ?? null,
                ]);
            }
        });

        return redirect('/inventory')->with('success', 'Product created successfully.');
    }

    public function edit(Product $product)
    {
        $product->load('variants');
        $categories = Category::all();

        return Inertia::render('Inventory/EditProduct', [
            'product' => $product,
            'categories' => $categories
        ]);
    }

    public function update(\Illuminate\Http\Request $request, Product $product)
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
        ]);

        DB::transaction(function () use ($validated, $product) {
            $product->update([
                'name' => $validated['name'],
                'category_id' => $validated['category_id'] ?? null,
                'type' => $validated['type'],
                'base_cost' => $validated['base_cost'] ?? 0,
                'retail_price' => $validated['retail_price'] ?? 0,
                'variant_options' => $validated['variant_options'] ?? null,
            ]);

            $existingVariantIds = [];
            foreach ($validated['variants'] as $v) {
                if (isset($v['id'])) {
                    $variant = $product->variants()->find($v['id']);
                    if ($variant) {
                        $variant->update([
                            'sku' => $v['sku'] ?? null,
                            'attributes' => $v['attributes'] ?? null,
                            'retail_price' => $v['retail_price'] ?? null,
                        ]);
                        $existingVariantIds[] = $variant->id;
                    }
                } else {
                    $newVariant = $product->variants()->create([
                        'sku' => $v['sku'] ?? null,
                        'attributes' => $v['attributes'] ?? null,
                        'retail_price' => $v['retail_price'] ?? null,
                    ]);
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
            'is_active' => !$product->is_active
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
}
