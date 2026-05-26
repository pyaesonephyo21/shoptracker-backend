<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $products = [
            [
                'shop_id' => 1,
                'category_id' => 1,
                'name' => 'Premium T-Shirt',
                'sku' => 'TS-001',
                'type' => 'global',
                'base_cost' => 12000,
                'retail_price' => 25000,
                'stock_quantity' => 45,
                'pending_stock' => 0,
            ],
            [
                'shop_id' => 1,
                'category_id' => 2,
                'name' => 'Wireless Mouse',
                'sku' => 'MS-002',
                'type' => 'global',
                'base_cost' => 20000,
                'retail_price' => 45000,
                'stock_quantity' => 4,
                'pending_stock' => 10,
            ],
            [
                'shop_id' => 1,
                'category_id' => 3,
                'name' => 'Desk Lamp',
                'sku' => 'DL-003',
                'type' => 'local',
                'base_cost' => 8000,
                'retail_price' => 15000,
                'stock_quantity' => 0,
                'pending_stock' => 0,
            ],
        ];

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
