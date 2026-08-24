<?php

namespace Database\Seeders;

use App\Models\Courier;
use Illuminate\Database\Seeder;

class CourierSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $couriers = [
            ['name' => 'Royal Express', 'contact_info' => '0987654321', 'default_service_fee' => 0, 'shop_id' => 1],
            ['name' => 'Wepozt', 'contact_info' => '0911223344', 'default_service_fee' => 200, 'shop_id' => 1],
        ];

        foreach ($couriers as $courier) {
            Courier::create($courier);
        }
    }
}
