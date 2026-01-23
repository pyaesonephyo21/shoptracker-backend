<?php

namespace App\Repositories;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ProductRepository
{
    /**
     * Handle the complex filtering logic here.
     */
    public function getAll(array $filters, int $perPage = 20): LengthAwarePaginator
    {
        return Product::query()
            ->filter($filters) // <--- The Model handles the logic now!
            ->latest()
            ->paginate($perPage);
    }

    public function findById($id): Product
    {
        $product = Product::with(['inventoryLogs' => function ($q) {
            $q->latest();
        }])->findOrFail($id);

        return $product;
    }

    public function create(array $data): Product
    {
        return Product::create($data);
    }

    public function update($id, array $data): Product
    {
        $product = $this->findById($id);
        $product->update($data);
        return $product;
    }

    public function delete($id): void
    {
        $product = $this->findById($id);
        $product->delete();
    }
}
