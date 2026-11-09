<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FormRequestValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_store_sales_order_validates_cart_presence(): void
    {
        $shop = Shop::create(['name' => 'Test Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->postJson('/sales', [
            'customer_name' => 'Walk-in',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cart']);
    }

    public function test_store_product_validates_and_creates_product_with_variants(): void
    {
        $shop = Shop::create(['name' => 'Test Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->post('/inventory', [
            'name' => 'Graphic T-Shirt',
            'type' => 'local',
            'base_cost' => 5000,
            'retail_price' => 8000,
            'variants' => [
                [
                    'sku' => 'TSHIRT-BLK-M',
                    'retail_price' => 8000,
                    'attributes' => ['color' => 'Black', 'size' => 'M'],
                ],
                [
                    'sku' => 'TSHIRT-BLK-L',
                    'retail_price' => 8500,
                    'attributes' => ['color' => 'Black', 'size' => 'L'],
                ],
            ],
        ]);

        $response->assertRedirect('/inventory');
        $this->assertDatabaseHas('products', [
            'shop_id' => $shop->id,
            'name' => 'Graphic T-Shirt',
        ]);
        $this->assertDatabaseHas('product_variants', [
            'sku' => 'TSHIRT-BLK-M',
            'retail_price' => 8000,
        ]);
        $this->assertDatabaseHas('product_variants', [
            'sku' => 'TSHIRT-BLK-L',
            'retail_price' => 8500,
        ]);
    }

    public function test_store_category_creates_category(): void
    {
        $shop = Shop::create(['name' => 'Test Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->post('/management/categories', [
            'name' => 'Apparel',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('categories', [
            'shop_id' => $shop->id,
            'name' => 'Apparel',
        ]);
    }

    public function test_store_supplier_maps_contact_input_to_contact_info(): void
    {
        $shop = Shop::create(['name' => 'Test Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->post('/management/suppliers', [
            'name' => 'Guangzhou Fabrics',
            'type' => 'foreign',
            'currency' => 'CNY',
            'contact' => 'WeChat: gz_fabrics',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('suppliers', [
            'shop_id' => $shop->id,
            'name' => 'Guangzhou Fabrics',
            'contact_info' => 'WeChat: gz_fabrics',
        ]);
    }

    public function test_mark_purchase_order_arrived_rejects_mismatched_item_id(): void
    {
        $shop = Shop::create(['name' => 'Test Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $po1 = PurchaseOrder::create([
            'shop_id' => $shop->id,
            'batch_name' => 'BATCH-001',
            'order_type' => 'local',
            'status' => 'pending',
            'payment_status' => 'pending',
        ]);

        $po2 = PurchaseOrder::create([
            'shop_id' => $shop->id,
            'batch_name' => 'BATCH-002',
            'order_type' => 'local',
            'status' => 'pending',
            'payment_status' => 'pending',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Item X',
            'type' => 'local',
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'ITEM-X',
        ]);

        $po2Item = PurchaseOrderItem::create([
            'purchase_order_id' => $po2->id,
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'original_cost' => 1000,
            'unit_cost' => 1000,
            'line_total' => 10000,
        ]);

        // Attempt to mark PO1 as arrived using an item ID belonging to PO2
        $response = $this->actingAs($user)->post("/inventory/purchase-orders/{$po1->id}/arrive", [
            'received_items' => [
                [
                    'id' => $po2Item->id,
                    'received_quantity' => 10,
                ],
            ],
        ]);

        $response->assertSessionHasErrors(['received_items.0.id']);
    }

    public function test_suggest_sku_endpoint_returns_sequential_base_code(): void
    {
        $shop = Shop::create(['name' => 'Test Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->getJson('/inventory/suggest-sku?name=Cotton+T-Shirt');

        $response->assertOk()
            ->assertJson([
                'base_code' => 'CTS01',
            ]);
    }
}
