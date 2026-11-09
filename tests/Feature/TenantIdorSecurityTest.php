<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIdorSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_user_cannot_update_retail_price_of_another_shops_variant(): void
    {
        $shopA = Shop::create(['name' => 'Shop A']);
        $shopB = Shop::create(['name' => 'Shop B']);

        $userA = User::factory()->create(['shop_id' => $shopA->id]);
        $userB = User::factory()->create(['shop_id' => $shopB->id]);

        $productA = $this->actingAs($userA)->runScoped(function () use ($shopA) {
            $product = Product::create([
                'shop_id' => $shopA->id,
                'name' => 'Product A',
                'type' => 'local',
                'base_cost' => 1000,
                'retail_price' => 1500,
            ]);

            return $product;
        });

        $variantA = ProductVariant::create([
            'product_id' => $productA->id,
            'sku' => 'SKU-A',
            'retail_price' => 1500,
        ]);

        $response = $this->actingAs($userB)->putJson("/inventory/variants/{$variantA->id}/retail-price", [
            'retail_price' => 9999,
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('product_variants', [
            'id' => $variantA->id,
            'retail_price' => 1500,
        ]);
    }

    public function test_user_cannot_restore_another_shops_variant(): void
    {
        $shopA = Shop::create(['name' => 'Shop A']);
        $shopB = Shop::create(['name' => 'Shop B']);

        $userA = User::factory()->create(['shop_id' => $shopA->id]);
        $userB = User::factory()->create(['shop_id' => $shopB->id]);

        $productA = Product::create([
            'shop_id' => $shopA->id,
            'name' => 'Product A',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 1500,
        ]);

        $variantA = ProductVariant::create([
            'product_id' => $productA->id,
            'sku' => 'SKU-A-DEL',
            'retail_price' => 1500,
        ]);
        $variantA->delete();

        $response = $this->actingAs($userB)->post("/inventory/variants/{$variantA->id}/restore");

        $response->assertStatus(404);
        $this->assertSoftDeleted('product_variants', ['id' => $variantA->id]);
    }

    public function test_user_cannot_create_sales_order_with_another_shops_variant(): void
    {
        $shopA = Shop::create(['name' => 'Shop A']);
        $shopB = Shop::create(['name' => 'Shop B']);

        $userA = User::factory()->create(['shop_id' => $shopA->id]);
        $userB = User::factory()->create(['shop_id' => $shopB->id]);

        $productA = Product::create([
            'shop_id' => $shopA->id,
            'name' => 'Product A',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 1500,
        ]);

        $variantA = ProductVariant::create([
            'product_id' => $productA->id,
            'sku' => 'SKU-SO-A',
            'retail_price' => 1500,
        ]);

        $response = $this->actingAs($userB)->postJson('/sales', [
            'customer_name' => 'Test Customer',
            'cart' => [
                [
                    'product_variant_id' => $variantA->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cart.0.product_variant_id']);
    }

    public function test_user_cannot_create_purchase_order_with_another_shops_variant(): void
    {
        $shopA = Shop::create(['name' => 'Shop A']);
        $shopB = Shop::create(['name' => 'Shop B']);

        $userA = User::factory()->create(['shop_id' => $shopA->id]);
        $userB = User::factory()->create(['shop_id' => $shopB->id]);

        $productA = Product::create([
            'shop_id' => $shopA->id,
            'name' => 'Product A',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 1500,
        ]);

        $variantA = ProductVariant::create([
            'product_id' => $productA->id,
            'sku' => 'SKU-PO-A',
            'retail_price' => 1500,
        ]);

        $response = $this->actingAs($userB)->post('/inventory/purchase-orders', [
            'order_type' => 'local',
            'items' => [
                [
                    'product_variant_id' => $variantA->id,
                    'quantity' => 10,
                    'unit_cost' => 800,
                ],
            ],
        ]);

        $response->assertSessionHasErrors(['items.0.product_variant_id']);
    }

    public function test_manual_cash_flow_records_authenticated_shop_id(): void
    {
        $shopA = Shop::create(['name' => 'Shop A']);
        $userA = User::factory()->create(['shop_id' => $shopA->id]);

        $response = $this->actingAs($userA)->post('/finance/cash-flow/manual', [
            'amount' => 50000,
            'type' => 'manual_in',
            'description' => 'Daily opening cash',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('cash_transactions', [
            'shop_id' => $shopA->id,
            'type' => 'manual_in',
            'amount' => 50000,
            'description' => 'Daily opening cash',
        ]);
    }

    private function runScoped(callable $callback): mixed
    {
        return $callback();
    }
}
