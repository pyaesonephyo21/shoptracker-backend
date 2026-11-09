<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Shop;
use App\Models\User;
use App\Services\SalesOrderService;
use Exception;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalesOrderServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_fifo_depletes_oldest_batches_first_and_splits_line_items(): void
    {
        $shop = Shop::create(['name' => 'Fashion Hub']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Silk Shirt',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 2000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'SILK-M',
            'stock_quantity' => 15,
            'retail_price' => 2000,
        ]);

        $batch1 = ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 5,
            'remaining_quantity' => 5,
            'unit_cost' => 1000,
            'retail_price' => 2000,
            'created_at' => now()->subDays(2),
        ]);

        $batch2 = ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 1200,
            'retail_price' => 2000,
            'created_at' => now()->subDay(),
        ]);

        $service = new SalesOrderService;
        $order = $service->createOrder(
            [
                'customer_name' => 'Daw Mya',
                'customer_phone' => '0912345678',
                'delivery_address' => 'Yangon',
            ],
            [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 7,
                ],
            ]
        );

        $batch1->refresh();
        $batch2->refresh();
        $variant->refresh();

        $this->assertSame(0, $batch1->remaining_quantity);
        $this->assertSame(8, $batch2->remaining_quantity);
        $this->assertSame(8, $variant->stock_quantity);

        $orderItems = $order->items()->orderBy('id')->get();
        $this->assertCount(2, $orderItems);

        $this->assertSame(5, $orderItems[0]->quantity);
        $this->assertEquals(1000, $orderItems[0]->unit_cost);

        $this->assertSame(2, $orderItems[1]->quantity);
        $this->assertEquals(1200, $orderItems[1]->unit_cost);
    }

    public function test_virtual_fifo_allocates_pre_order_from_pending_purchase_orders(): void
    {
        $shop = Shop::create(['name' => 'Fashion Hub']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Denim Jacket',
            'type' => 'global',
            'base_cost' => 2500,
            'retail_price' => 5000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'DENIM-L',
            'stock_quantity' => 0,
            'pending_stock' => 10,
            'retail_price' => 5000,
        ]);

        $po = PurchaseOrder::create([
            'shop_id' => $shop->id,
            'batch_name' => 'PO-DEC-01',
            'order_type' => 'global',
            'status' => 'pending',
            'payment_status' => 'pending',
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'original_cost' => 25,
            'unit_cost' => 3000,
            'line_total' => 30000,
        ]);

        $service = new SalesOrderService;
        $order = $service->createOrder(
            [
                'customer_name' => 'Ko Aung',
                'customer_phone' => '0998765432',
                'delivery_address' => 'Mandalay',
            ],
            [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 4,
                ],
            ]
        );

        $variant->refresh();
        $this->assertSame(-4, $variant->stock_quantity);

        $item = $order->items()->first();
        $this->assertNotNull($item);
        $this->assertSame(4, $item->quantity);
        $this->assertEquals(3000, $item->unit_cost);
    }

    public function test_exceeding_total_available_stock_throws_exception(): void
    {
        $shop = Shop::create(['name' => 'Fashion Hub']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Limited Bag',
            'type' => 'local',
            'base_cost' => 5000,
            'retail_price' => 8000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'BAG-RED',
            'stock_quantity' => 2,
            'pending_stock' => 0,
            'retail_price' => 8000,
        ]);

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Stock limit exceeded for: Limited Bag (BAG-RED)');

        $service = new SalesOrderService;
        $service->createOrder(
            ['customer_name' => 'Customer'],
            [['product_variant_id' => $variant->id, 'quantity' => 5]]
        );
    }

    public function test_order_financial_calculations_with_discount_and_courier_fees(): void
    {
        $shop = Shop::create(['name' => 'Fashion Hub']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Cotton Polo',
            'type' => 'local',
            'base_cost' => 4000,
            'retail_price' => 10000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'POLO-WHT',
            'stock_quantity' => 10,
            'retail_price' => 10000,
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 4000,
            'retail_price' => 10000,
        ]);

        $service = new SalesOrderService;
        $order = $service->createOrder(
            [
                'customer_name' => 'U Ba',
                'discount_type' => 'fixed',
                'discount_value' => 2000,
                'delivery_fee' => 3000,
                'courier_service_fee' => 500,
                'overcharge' => 1000,
                'extra_fee' => 500,
            ],
            [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 2,
                ],
            ]
        );

        // Subtotal: 2 * 10000 = 20000
        // Discount total: 2000
        // After discount: 18000
        // Customer Grand Total = 18000 + delivery_fee(3000) + overcharge(1000) + extra_fee(500) = 22500
        // Net Revenue = 18000 + overcharge(1000) + extra_fee(500) - courier_service_fee(500) = 19000
        // Total cost: 2 * 4000 = 8000
        // Net Profit: 19000 - 8000 = 11000

        $order->refresh();
        $this->assertEquals(20000, $order->subtotal);
        $this->assertEquals(2000, $order->discount_total);
        $this->assertEquals(22500, $order->customer_grand_total);
        $this->assertEquals(19000, $order->net_revenue);
        $this->assertEquals(8000, $order->total_cost);
        $this->assertEquals(11000, $order->net_profit);
    }

    public function test_return_item_restores_stock_to_newest_batches_first_lifo(): void
    {
        $shop = Shop::create(['name' => 'Fashion Hub']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Linen Dress',
            'type' => 'local',
            'base_cost' => 5000,
            'retail_price' => 12000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'DRESS-S',
            'stock_quantity' => 10,
            'retail_price' => 12000,
        ]);

        $batch1 = ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 4,
            'remaining_quantity' => 4,
            'unit_cost' => 5000,
            'retail_price' => 12000,
            'created_at' => now()->subDays(2),
        ]);

        $batch2 = ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 6,
            'remaining_quantity' => 6,
            'unit_cost' => 5500,
            'retail_price' => 12000,
            'created_at' => now()->subDay(),
        ]);

        $service = new SalesOrderService;
        $order = $service->createOrder(
            ['customer_name' => 'Ma Hla'],
            [['product_variant_id' => $variant->id, 'quantity' => 6]]
        );

        $batch1->refresh();
        $batch2->refresh();
        $this->assertSame(0, $batch1->remaining_quantity); // Batch 1 took 4
        $this->assertSame(4, $batch2->remaining_quantity); // Batch 2 took 2

        $item2 = $order->items()->where('unit_cost', 5500)->firstOrFail();
        $service->returnItem($order->id, $item2->id, 2, 'Customer changed mind');

        $batch1->refresh();
        $batch2->refresh();
        $variant->refresh();

        // Batch 2 should be restored by 2 (LIFO return), Batch 1 remains 0
        $this->assertSame(6, $batch2->remaining_quantity);
        $this->assertSame(0, $batch1->remaining_quantity);
        $this->assertSame(6, $variant->stock_quantity);
    }

    public function test_sequential_order_numbers_are_scoped_per_shop_independently(): void
    {
        $shopA = Shop::create(['name' => 'Shop Alpha']);
        $shopB = Shop::create(['name' => 'Shop Beta']);

        $userA = User::factory()->create(['shop_id' => $shopA->id]);
        $userB = User::factory()->create(['shop_id' => $shopB->id]);

        $productA = Product::create([
            'shop_id' => $shopA->id,
            'name' => 'Product A',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 2000,
        ]);
        $variantA = ProductVariant::create([
            'product_id' => $productA->id,
            'sku' => 'VAR-A',
            'stock_quantity' => 100,
            'retail_price' => 2000,
        ]);
        ProductBatch::create([
            'shop_id' => $shopA->id,
            'product_variant_id' => $variantA->id,
            'initial_quantity' => 100,
            'remaining_quantity' => 100,
            'unit_cost' => 1000,
            'retail_price' => 2000,
        ]);

        $productB = Product::create([
            'shop_id' => $shopB->id,
            'name' => 'Product B',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 2000,
        ]);
        $variantB = ProductVariant::create([
            'product_id' => $productB->id,
            'sku' => 'VAR-B',
            'stock_quantity' => 100,
            'retail_price' => 2000,
        ]);
        ProductBatch::create([
            'shop_id' => $shopB->id,
            'product_variant_id' => $variantB->id,
            'initial_quantity' => 100,
            'remaining_quantity' => 100,
            'unit_cost' => 1000,
            'retail_price' => 2000,
        ]);

        $service = new SalesOrderService;

        // Shop A Order #1
        $this->actingAs($userA);
        $orderA1 = $service->createOrder(
            ['customer_name' => 'Customer A1'],
            [['product_variant_id' => $variantA->id, 'quantity' => 1]]
        );
        $this->assertSame(1, $orderA1->order_number);

        // Shop A Order #2
        $orderA2 = $service->createOrder(
            ['customer_name' => 'Customer A2'],
            [['product_variant_id' => $variantA->id, 'quantity' => 1]]
        );
        $this->assertSame(2, $orderA2->order_number);

        // Switch to Shop B -> Order #1
        $this->actingAs($userB);
        $orderB1 = $service->createOrder(
            ['customer_name' => 'Customer B1'],
            [['product_variant_id' => $variantB->id, 'quantity' => 1]]
        );
        $this->assertSame(1, $orderB1->order_number);

        // Shop B Order #2
        $orderB2 = $service->createOrder(
            ['customer_name' => 'Customer B2'],
            [['product_variant_id' => $variantB->id, 'quantity' => 1]]
        );
        $this->assertSame(2, $orderB2->order_number);

        // Switch back to Shop A -> Order #3
        $this->actingAs($userA);
        $orderA3 = $service->createOrder(
            ['customer_name' => 'Customer A3'],
            [['product_variant_id' => $variantA->id, 'quantity' => 1]]
        );
        $this->assertSame(3, $orderA3->order_number);

        // Verify global IDs continue to increment, but per-shop sequence is independent
        $this->assertNotSame($orderA1->id, $orderB1->id);
        $this->assertSame(1, $orderA1->order_number);
        $this->assertSame(1, $orderB1->order_number);
    }
}
