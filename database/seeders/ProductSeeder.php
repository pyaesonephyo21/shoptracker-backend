<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $products = [];
        
        $baseProducts = [
            ['name' => 'Premium T-Shirt', 'sku_prefix' => 'TS', 'category_id' => 1, 'type' => 'global', 'base_cost' => 12000, 'retail_price' => 25000],
            ['name' => 'Wireless Mouse', 'sku_prefix' => 'MS', 'category_id' => 2, 'type' => 'global', 'base_cost' => 20000, 'retail_price' => 45000],
            ['name' => 'Desk Lamp', 'sku_prefix' => 'DL', 'category_id' => 3, 'type' => 'local', 'base_cost' => 8000, 'retail_price' => 15000],
        ];

        for ($i = 1; $i <= 45; $i++) {
            $base = $baseProducts[$i % 3];
            $products[] = [
                'shop_id' => 1,
                'category_id' => $base['category_id'],
                'name' => $base['name'] . ' Variant ' . str_pad($i, 3, '0', STR_PAD_LEFT),
                'sku' => $base['sku_prefix'] . '-' . str_pad($i, 3, '0', STR_PAD_LEFT),
                'type' => $base['type'],
                'base_cost' => $base['base_cost'],
                'retail_price' => $base['retail_price'],
                'stock_quantity' => rand(0, 50),
                'pending_stock' => rand(0, 20),
            ];
        }

        foreach ($products as $productData) {
            $product = \App\Models\Product::create($productData);

            // Log initial inventory if stock > 0
            if ($product->stock_quantity > 0) {
                \App\Models\InventoryLog::create([
                    'shop_id' => 1,
                    'product_id' => $product->id,
                    'quantity_change' => $product->stock_quantity,
                    'new_stock_level' => $product->stock_quantity,
                    'reason' => 'initial_seed',
                    'note' => 'Initial system seed'
                ]);
            }
        }
    }
}
