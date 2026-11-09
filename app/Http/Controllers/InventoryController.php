<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrderItem;
use App\Models\SalesOrderItem;
use App\Services\SkuGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->input('status', 'active');
        $query = Product::with(['category', 'variants'])
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

    public function store(StoreProductRequest $request, SkuGeneratorService $skuService): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $skuService, $request) {
            $product = Product::create([
                'name' => $validated['name'],
                'category_id' => $validated['category_id'] ?? null,
                'type' => $validated['type'],
                'base_cost' => $validated['base_cost'] ?? 0,
                'retail_price' => $validated['retail_price'] ?? 0,
                'variant_options' => $validated['variant_options'] ?? null,
            ]);

            $categoryName = ! empty($validated['category_id']) ? Category::find($validated['category_id'])?->name : null;
            $baseCode = $skuService->generateBaseCode($validated['name'], $request->user()->shop_id, $categoryName);

            foreach ($validated['variants'] as $v) {
                $sku = ! empty($v['sku']) ? $v['sku'] : $skuService->generateVariantSku($baseCode, $v['attributes'] ?? []);

                $product->variants()->create([
                    'sku' => $sku,
                    'attributes' => $v['attributes'] ?? null,
                    'retail_price' => $v['retail_price'] ?? null,
                ]);
            }
        });

        return redirect('/inventory')->with('success', 'Product created successfully.');
    }

    public function suggestSku(Request $request, SkuGeneratorService $skuService): JsonResponse
    {
        $name = (string) $request->input('name', '');
        $categoryName = $request->input('category_id') ? Category::find($request->category_id)?->name : null;
        $baseCode = $skuService->generateBaseCode($name, $request->user()->shop_id, $categoryName);

        return response()->json([
            'base_code' => $baseCode,
        ]);
    }

    public function edit(Product $product)
    {
        $product->load('variants');
        $categories = Category::all();

        return Inertia::render('Inventory/EditProduct', [
            'product' => $product,
            'categories' => $categories,
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $validated = $request->validated();

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
            'is_active' => ! $product->is_active,
        ]);

        $statusMessage = $product->is_active ? 'restored' : 'archived';

        return back()->with('success', "Product {$statusMessage} successfully.");
    }

    public function restoreVariant($id)
    {
        $variant = ProductVariant::withTrashed()
            ->whereHas('product')
            ->findOrFail($id);

        $variant->restore();

        return back()->with('success', 'Variant restored successfully.');
    }

    public function updateRetailPrice(Request $request, ProductVariant $variant)
    {
        abort_unless($variant->product && (int) $variant->product->shop_id === (int) auth()->user()->shop_id, 403);

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
