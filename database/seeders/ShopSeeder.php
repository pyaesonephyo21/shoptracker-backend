<?php

namespace Database\Seeders;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;

class ShopSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. HER WORLD (Simple)
        $retroBites = Shop::create([
            'name' => "Retro Bites",
            'settings' => ['foreign_mode' => false]
        ]);

        User::create([
            'shop_id' => $retroBites->id,
            'name' => 'Retro Bites',
            'email' => 'retrobites@test.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);

        User::create([
            'shop_id' => $retroBites->id,
            'name' => 'Pyae (Admin)',
            'email' => 'pyae@retrobites.com', // <--- Distinct Email
            'password' => bcrypt('password'),
            'role' => 'admin'
        ]);

        // 2. YOUR WORLD (Complex)
        $trendyNest = Shop::create([
            'name' => "Trendy Nest",
            'settings' => ['foreign_mode' => true]
        ]);

        User::create([
            'shop_id' => $trendyNest->id,
            'name' => 'Trendy Nest',
            'email' => 'trendynest@test.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);

        User::create([
            'shop_id' => $trendyNest->id,
            'name' => 'Pyae Owner',
            'email' => 'pyae@trendynest.com', // <--- Your Main Email
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);
    }
}
