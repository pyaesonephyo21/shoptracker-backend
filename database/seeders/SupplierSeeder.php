<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $suppliers = [
            ['name' => 'Tech Supply Co', 'type' => 'foreign', 'currency' => 'USD', 'contact_info' => 'sales@techsupply.com', 'shop_id' => 1],
            ['name' => 'Local Electronics', 'type' => 'local', 'currency' => 'MMK', 'contact_info' => '09123456789', 'shop_id' => 1],
        ];

        foreach ($suppliers as $supplier) {
            \App\Models\Supplier::create($supplier);
        }
    }
}
