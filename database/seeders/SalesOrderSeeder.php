<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\SalesOrder;
use App\Models\Shop;
use App\Models\Product;
use App\Models\Courier;
use App\Services\SalesOrderService;

class SalesOrderSeeder extends Seeder
{
    public function run(): void
    {
        $shop = Shop::first();
        if (!$shop) return;

        $products = Product::where('stock_quantity', '>=', 5)->take(3)->get();
        if ($products->count() < 2) return; // Need at least some stock

        $courier = Courier::first();
        $service = new SalesOrderService();

        // 1. Pending Order
        $service->createOrder([
            'customer_name' => 'John Doe',
            'customer_phone' => '09123456789',
            'delivery_address' => 'No. 1, Yangon',
            'discount_type' => 'fixed',
            'discount_value' => 5000,
            'discount_reason' => 'First purchase',
            'note' => 'Please call before delivery',
            'paid_amount' => 0,
        ], [
            [
                'product_id' => $products[0]->id,
                'quantity' => 2,
            ],
            [
                'product_id' => $products[1]->id,
                'quantity' => 1,
            ]
        ]);

        // 2. Delivery Arranged Order
        $order2 = clone $service->createOrder([
            'customer_name' => 'Jane Smith',
            'customer_phone' => '09987654321',
            'delivery_address' => 'No. 2, Mandalay',
            'note' => 'Leave at door',
            'paid_amount' => 10000,
        ], [
            [
                'product_id' => $products[0]->id,
                'quantity' => 1,
            ]
        ]);

        if ($courier) {
            $service->fulfillOrder($order2->id, [
                'courier_id' => $courier->id,
                'tracking_number' => 'MM-123456',
                'delivery_fee' => 2500,
                'courier_service_fee' => 500,
                'money_collected_by' => 'courier',
                'is_deli_prepaid' => false,
            ]);
        }

        // 3. Completed / Collected Money Order
        $order3 = clone $service->createOrder([
            'customer_name' => 'Bob Marley',
            'customer_phone' => '0922334455',
            'delivery_address' => 'No. 3, Naypyidaw',
            'paid_amount' => 0,
        ], [
            [
                'product_id' => $products[1]->id,
                'quantity' => 2,
            ]
        ]);

        if ($courier) {
            $service->fulfillOrder($order3->id, [
                'courier_id' => $courier->id,
                'delivery_fee' => 2500,
                'courier_service_fee' => 500,
                'money_collected_by' => 'courier',
            ]);

            $service->markAsDelivered($order3->id);
            $service->settle($order3->id, 'kpay');
        }
    }
}
