<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use App\Services\PurchaseOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_create_global_purchase_order_calculates_supplier_fees_and_increments_pending_stock(): void
    {
        $shop = Shop::create(['name' => 'Import Central']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $supplier = Supplier::create([
            'shop_id' => $shop->id,
            'name' => 'Shenzhen Electronics',
            'type' => 'foreign',
            'currency' => 'CNY',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Wireless Earbuds',
            'type' => 'global',
            'base_cost' => 10000,
            'retail_price' => 25000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'EARBUD-BLK',
            'stock_quantity' => 0,
            'pending_stock' => 0,
            'retail_price' => 25000,
        ]);

        $service = new PurchaseOrderService;
        $po = $service->createOrder([
            'order_type' => 'global',
            'batch_name' => 'PO-DEC-01',
            'supplier_id' => $supplier->id,
            'exchange_rate' => 500,
            'foreign_deli_fee' => 20,
            'total_discount' => 10,
            'supplier_fee_percentage' => 5,
            'paid_amount' => 50000,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 10,
                    'unit_cost' => 20, // 20 CNY per unit
                ],
            ],
        ]);

        // Goods cost = 10 * 20 = 200 CNY
        // Fee base = 200 + 20 (deli) - 10 (discount) = 210 CNY
        // Supplier fee = 210 * 5% = 10.5 CNY
        // Total CNY = 200 + 20 - 10 + 10.5 = 220.5 CNY
        // Total MMK = 220.5 * 500 = 110,250 MMK

        $this->assertSame('pending', $po->status);
        $this->assertEquals(10.5, $po->supplier_fee);
        $this->assertEquals(110250, $po->grand_total);

        $variant->refresh();
        $this->assertSame(10, $variant->pending_stock);
    }

    public function test_mark_as_arrived_calculates_true_landed_unit_cost_and_creates_batch(): void
    {
        $shop = Shop::create(['name' => 'Import Central']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Smart Watch',
            'type' => 'global',
            'base_cost' => 10000,
            'retail_price' => 30000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'WATCH-PRO',
            'stock_quantity' => 0,
            'pending_stock' => 10,
            'retail_price' => 30000,
        ]);

        $po = PurchaseOrder::create([
            'shop_id' => $shop->id,
            'batch_name' => 'PO-WATCH-01',
            'order_type' => 'global',
            'status' => 'pending',
            'payment_status' => 'pending',
            'exchange_rate' => 500,
            'foreign_deli_fee' => 20,
            'supplier_fee' => 10.5,
            'total_discount' => 10,
        ]);

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'original_cost' => 20,
            'unit_cost' => 10000,
            'line_total' => 100000,
        ]);

        $service = new PurchaseOrderService;
        $service->markAsArrived($po, [
            'cargo_fee' => 15000,
            'adjustment_amount' => 5000,
            'received_items' => [
                [
                    'id' => $poItem->id,
                    'received_quantity' => 10,
                    'retail_price' => 30000,
                    'allocated_cargo_fee' => 15000,
                    'allocated_adjustment_amount' => 5000,
                ],
            ],
        ]);

        // Base unit cost (MMK) = 20 * 500 = 10,000
        // Foreign deli per unit = (20 * 500) / 10 = 1,000
        // Supplier fee per unit = (10.5 * 500) / 10 = 525
        // Discount per unit = (10 * 500) / 10 = 500
        // Cargo per unit = 15000 / 10 = 1,500
        // Adj per unit = 5000 / 10 = 500
        // Landed unit cost = 10000 + 1000 + 525 - 500 + 1500 + 500 = 13,025 MMK

        $batch = ProductBatch::where('product_variant_id', $variant->id)->first();
        $this->assertNotNull($batch);
        $this->assertEquals(13025, $batch->unit_cost);
        $this->assertSame(10, $batch->remaining_quantity);

        $variant->refresh();
        $this->assertSame(10, $variant->stock_quantity);
        $this->assertSame(0, $variant->pending_stock);

        $po->refresh();
        $this->assertSame('arrived', $po->status);
    }

    public function test_mark_as_arrived_fulfills_preorder_deficit_stock(): void
    {
        $shop = Shop::create(['name' => 'Import Central']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Canvas Backpack',
            'type' => 'local',
            'base_cost' => 8000,
            'retail_price' => 15000,
        ]);

        // Simulating 4 pre-ordered units that drove physical stock negative
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'BAG-BLK',
            'stock_quantity' => -4,
            'pending_stock' => 10,
            'retail_price' => 15000,
        ]);

        $po = PurchaseOrder::create([
            'shop_id' => $shop->id,
            'batch_name' => 'PO-BAG-01',
            'order_type' => 'local',
            'status' => 'pending',
            'payment_status' => 'pending',
            'exchange_rate' => 1,
            'foreign_deli_fee' => 0,
            'supplier_fee' => 0,
            'total_discount' => 0,
        ]);

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_variant_id' => $variant->id,
            'quantity' => 10,
            'original_cost' => 8000,
            'unit_cost' => 8000,
            'line_total' => 80000,
        ]);

        $service = new PurchaseOrderService;
        $service->markAsArrived($po, [
            'cargo_fee' => 0,
            'received_items' => [
                [
                    'id' => $poItem->id,
                    'received_quantity' => 10,
                    'retail_price' => 15000,
                ],
            ],
        ]);

        $batch = ProductBatch::where('product_variant_id', $variant->id)->first();
        $this->assertNotNull($batch);

        // 4 units consumed by pre-order deficit: 10 - 4 = 6 remaining in batch
        $this->assertSame(6, $batch->remaining_quantity);

        $variant->refresh();
        // Physical stock updated: -4 + 10 = 6
        $this->assertSame(6, $variant->stock_quantity);
        $this->assertSame(0, $variant->pending_stock);
    }

    public function test_cancel_purchase_order_records_sunk_cost_expense_and_restores_pending_stock(): void
    {
        $shop = Shop::create(['name' => 'Import Central']);
        $user = User::factory()->create(['shop_id' => $shop->id]);
        $this->actingAs($user);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Mechanical Keyboard',
            'type' => 'local',
            'base_cost' => 30000,
            'retail_price' => 60000,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'KB-RGB',
            'stock_quantity' => 0,
            'pending_stock' => 5,
            'retail_price' => 60000,
        ]);

        $po = PurchaseOrder::create([
            'shop_id' => $shop->id,
            'batch_name' => 'PO-KB-01',
            'order_type' => 'local',
            'status' => 'pending',
            'payment_status' => 'partial',
            'paid_amount' => 50000, // Deposit paid
            'exchange_rate' => 1,
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_variant_id' => $variant->id,
            'quantity' => 5,
            'original_cost' => 30000,
            'unit_cost' => 30000,
            'line_total' => 150000,
        ]);

        $service = new PurchaseOrderService;
        // Supplier only refunded 30,000 out of 50,000 deposit; loss = 20,000
        $service->cancelOrder($po, 'Supplier out of stock', 30000);

        $variant->refresh();
        $this->assertSame(0, $variant->pending_stock);

        $this->assertDatabaseHas('expenses', [
            'shop_id' => $shop->id,
            'amount' => 20000,
            'category' => 'PO Sunk Cost',
        ]);

        $this->assertDatabaseHas('cash_transactions', [
            'shop_id' => $shop->id,
            'amount' => 30000,
            'type' => 'refund',
        ]);

        $po->refresh();
        $this->assertSame('cancelled', $po->status);
        $this->assertSame('Supplier out of stock', $po->cancel_reason);
    }
}
