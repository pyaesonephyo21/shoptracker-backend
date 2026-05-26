<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class PurchaseOrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $shopId = 1;

        // 1. A pending foreign order
        $po1 = \App\Models\PurchaseOrder::create([
            'shop_id' => $shopId,
            'supplier_id' => 1, // Tech Supply Co (from SupplierSeeder)
            'batch_name' => 'SEP-001',
            'status' => 'pending',
            'exchange_rate' => 500.00, // 1 CNY = 500 MMK
            'total_goods_cost' => 1000.00, // 1000 CNY
            'supplier_fee' => 50.00, // 50 CNY
            'cargo_fee' => 0,
            'local_deli_fee' => 0,
            'grand_total' => 525000.00, // (1000 + 50) * 500
            'payment_status' => 'partial',
            'paid_amount' => 100000.00,
        ]);

        \App\Models\PurchaseOrderItem::create([
            'purchase_order_id' => $po1->id,
            'product_id' => 1, // Premium T-Shirt
            'quantity' => 100,
            'original_cost' => 10.00, // 10 CNY
            'unit_cost' => 5000.00, // 10 * 500
            'line_total' => 500000.00,
        ]);

        // 2. An arrived local order
        $po2 = \App\Models\PurchaseOrder::create([
            'shop_id' => $shopId,
            'supplier_id' => null,
            'local_shop_name' => 'Local Tech Market',
            'batch_name' => 'OCT-002',
            'status' => 'arrived',
            'exchange_rate' => 1.00,
            'total_goods_cost' => 100000.00,
            'supplier_fee' => 0,
            'cargo_fee' => 0,
            'local_deli_fee' => 2000.00,
            'grand_total' => 102000.00,
            'payment_status' => 'paid',
            'paid_amount' => 102000.00,
        ]);

        \App\Models\PurchaseOrderItem::create([
            'purchase_order_id' => $po2->id,
            'product_id' => 2, // Wireless Mouse
            'quantity' => 10,
            'original_cost' => 10000.00,
            'unit_cost' => 10000.00,
            'line_total' => 100000.00,
        ]);
    }
}
