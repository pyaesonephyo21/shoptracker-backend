<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Shop;
use App\Models\User;

class ShopSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $testShop = Shop::create([
            'name' => "Test Shop",
        ]);

        // 1. SIMPLE WORLD
        $retroBites = Shop::create([
            'name' => "Retro Bites",
        ]);

        $retroOwner = User::create([
            'shop_id' => $retroBites->id,
            'name' => 'Retro Bites',
            'email' => 'retrobites@gmail.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);
        $retroOwner->shops()->attach($retroBites->id);

        // 2. YOUR WORLD (Complex)
        $trendyNest = Shop::create([
            'name' => "Trendy Nest",
        ]);

        $trendyOwner = User::create([
            'shop_id' => $trendyNest->id,
            'name' => 'Trendy Nest',
            'email' => 'trendynest@gmail.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);
        $trendyOwner->shops()->attach($trendyNest->id);

        $pan = User::create([
            'shop_id' => $trendyNest->id,
            'name' => 'Pan Ywe Phu',
            'email' => 'panywephu@gmail.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);
        $pan->shops()->attach($trendyNest->id);

        // 3. SUPERADMIN
        $superAdmin = User::create([
            'shop_id' => $retroBites->id,
            'name' => 'Super Admin',
            'email' => 'admin@shoptracker.com',
            'password' => bcrypt('password'),
            'role' => 'superadmin'
        ]);
        $superAdmin->shops()->attach([$retroBites->id, $trendyNest->id, $testShop->id]);

        $pyaeOwner = User::create([
            'shop_id' => $trendyNest->id,
            'name' => 'Pyae Sone',
            'email' => 'pyaesone@gmail.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);
        $pyaeOwner->shops()->attach([$retroBites->id, $trendyNest->id, $testShop->id]);

        // 4. REGIONAL MANAGER
        $regionalManager = User::create([
            'shop_id' => $trendyNest->id,
            'name' => 'Regional Manager',
            'email' => 'manager@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin'
        ]);
        $regionalManager->shops()->attach([$retroBites->id, $trendyNest->id]);

        $testUser = User::create([
            'shop_id' => $testShop->id,
            'name' => 'Test User',
            'email' => 'test@gmail.com',
            'password' => bcrypt('password'),
            'role' => 'owner'
        ]);
        $testUser->shops()->attach([$testShop->id]);
    }
}
