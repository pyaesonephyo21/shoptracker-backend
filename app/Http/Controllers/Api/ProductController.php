<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use App\Http\Resources\ProductResource;
use App\Repositories\ProductRepository;
use App\Http\Requests\StoreProductRequest;

class ProductController extends Controller
{
    // 1. Inject the Repository
    public function __construct(
        protected ProductRepository $productRepo
    ) {}

    public function index()
    {
        $products = QueryBuilder::for(\App\Models\Product::class)
            ->allowedFilters([
                'name', // ?filter[name]=Shirt (Partial match)
                'sku',
                AllowedFilter::exact('category_id'), // ?filter[category_id]=1 (Exact match)
                AllowedFilter::exact('status'), // ?filter[status]=in_stock
            ])
            ->allowedSorts([
                'retail_price', // ?sort=retail_price (Low to High)
                'created_at',   // ?sort=-created_at (High to Low, notice the minus)
                'stock_quantity'
            ])
            ->allowedIncludes(['category']) // ?include=category (Loads the relationship)
            ->paginate(20); // Always paginate to prevent crashing the app with 1000 items

        return ProductResource::collection($products);
    }

    public function store(StoreProductRequest $request)
    {
        // 1. Extract the data
        $data = $request->validated();

        // 2. Remove 'image' from the array
        // If we don't do this, the Repository will try to save the FILE into the
        // 'products' table, causing a "Column not found: image" error.
        unset($data['image']);

        // 3. Create Product via Repository (Clean Data only)
        $product = $this->productRepo->create($data);

        // 4. Handle Image Upload separately
        if ($request->hasFile('image')) {
            $product->addMediaFromRequest('image')
                ->toMediaCollection('products');
        }

        // 5. Return JSON (The 'image_url' accessor from the Model will show up here)
        return new ProductResource($product);
    }

    public function show($id)
    {
        $product = $this->productRepo->findById($id);

        return new ProductResource($product);
    }

    public function update(Request $request, $id)
    {
        // Validation usually goes in a FormRequest, but simple here is fine
        $product = $this->productRepo->update($request->all(), $id);
        return response()->json(['message' => 'Updated', 'product' => $product]);
    }

    public function destroy($id)
    {
        $this->productRepo->delete($id);
        return response()->json(['message' => 'Deleted']);
    }
}
