<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            ['name' => 'Apparel', 'shop_id' => 1],
            ['name' => 'Electronics', 'shop_id' => 1],
            ['name' => 'Home', 'shop_id' => 1],
        ];

        foreach ($categories as $category) {
            \App\Models\Category::create($category);
        }
    }
}
