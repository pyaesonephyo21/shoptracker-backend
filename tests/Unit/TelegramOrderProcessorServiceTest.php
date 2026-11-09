<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Shop;
use App\Services\AiAddressParserService;
use App\Services\SalesOrderService;
use App\Services\TelegramOrderProcessorService;
use App\Services\TelegramService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramOrderProcessorServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_successfully_processes_order_and_sends_telegram_confirmation_with_order_url(): void
    {
        Config::set('app.url', 'https://shop.example.com');
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create([
            'name' => 'Fashion Boutique',
            'currency_code' => 'MMK',
            'telegram_chat_id' => '-100999888',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Infinity Necklace',
            'type' => 'local',
            'base_cost' => 20000,
            'retail_price' => 35000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'INF-SLV',
            'retail_price' => 35000,
            'stock_quantity' => 10,
            'pending_stock' => 0,
            'attributes' => ['Color' => 'Silver'],
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 20000,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/test_chat.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/test_chat.jpg' => Http::response('mock-image-bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 1001],
            ], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'ဒေါ်နွယ်နွယ်ဝင်း',
                    'customer_phone' => '09772775937',
                    'delivery_address' => 'အမှတ် ၁၁ ရပ်ကွက်၊ သာကေတမြို့နယ်၊ ရန်ကုန်',
                    'delivery_notes' => 'ရုံးချိန်အတွင်းပို့ပါ',
                    'items' => [
                        [
                            'product_variant_id' => $variant->id,
                            'quantity' => 2,
                        ],
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $messageData = [
            'message_id' => 456,
            'chat' => ['id' => '-100999888'],
            'photo' => [
                ['file_id' => 'thumb_1', 'width' => 100],
                ['file_id' => 'full_photo_1', 'width' => 800],
            ],
            'caption' => 'Infinity Silver 2',
        ];

        $order = $processor->process($shop->id, $messageData);

        $this->assertInstanceOf(SalesOrder::class, $order);
        $this->assertSame($shop->id, $order->shop_id);
        $this->assertSame('ဒေါ်နွယ်နွယ်ဝင်း', $order->customer_name);
        $this->assertSame('09772775937', $order->customer_phone);
        $this->assertSame('အမှတ် ၁၁ ရပ်ကွက်၊ သာကေတမြို့နယ်၊ ရန်ကုန်', $order->delivery_address);
        $this->assertSame('ရုံးချိန်အတွင်းပို့ပါ', $order->delivery_note);
        $this->assertSame(70000.0, (float) $order->customer_grand_total);

        // Check variant stock deduction
        $variant->refresh();
        $this->assertSame(8, $variant->stock_quantity);

        // Check database records
        $this->assertDatabaseHas('sales_orders', [
            'id' => $order->id,
            'shop_id' => $shop->id,
            'customer_name' => 'ဒေါ်နွယ်နွယ်ဝင်း',
        ]);

        $this->assertDatabaseHas('sales_order_items', [
            'sales_order_id' => $order->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
        ]);

        // Verify Telegram message was sent with order URL
        Http::assertSent(function ($request) use ($order) {
            if ($request->url() !== 'https://api.telegram.org/bottest-bot-token/sendMessage') {
                return false;
            }

            $text = $request['text'];
            $expectedUrl = "https://shop.example.com/sales/{$order->id}";

            return $request['chat_id'] === '-100999888'
                && $request['reply_to_message_id'] === 456
                && str_contains($text, 'Order Created Successfully')
                && str_contains($text, "Order ID:</b> #{$order->id}")
                && str_contains($text, 'ဒေါ်နွယ်နွယ်ဝင်း')
                && str_contains($text, 'INF-SLV')
                && str_contains($text, $expectedUrl);
        });
    }

    public function test_handles_missing_photo_gracefully_and_notifies_user(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create([
            'name' => 'Fashion Boutique',
            'telegram_chat_id' => '-100999888',
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->never())->method('parseOrder');

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $messageData = [
            'message_id' => 777,
            'chat' => ['id' => '-100999888'],
            'text' => 'Just text without photo',
        ];

        $order = $processor->process($shop->id, $messageData);

        $this->assertNull($order);
        Http::assertSent(function ($request) {
            return $request['chat_id'] === '-100999888'
                && str_contains($request['text'], 'Please send a customer chat screenshot');
        });
    }

    public function test_rejects_and_prevents_idor_if_variant_belongs_to_another_shop(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shopA = Shop::create(['name' => 'Shop A', 'telegram_chat_id' => '-100111']);
        $shopB = Shop::create(['name' => 'Shop B', 'telegram_chat_id' => '-100222']);

        $productB = Product::create([
            'shop_id' => $shopB->id,
            'name' => 'Product of Shop B',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 2000,
            'is_active' => true,
        ]);

        $variantB = ProductVariant::create([
            'product_id' => $productB->id,
            'sku' => 'SKU-B',
            'retail_price' => 2000,
            'stock_quantity' => 10,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/test.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/test.jpg' => Http::response('bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        // Even if shopA has a product, parser returns variant of shopB
        $productA = Product::create([
            'shop_id' => $shopA->id,
            'name' => 'Product of Shop A',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 2000,
            'is_active' => true,
        ]);
        ProductVariant::create([
            'product_id' => $productA->id,
            'sku' => 'SKU-A',
            'retail_price' => 2000,
            'stock_quantity' => 10,
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'Customer',
                    'customer_phone' => '09123456789',
                    'delivery_address' => 'Yangon',
                    'items' => [
                        ['product_variant_id' => $variantB->id, 'quantity' => 1],
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $messageData = [
            'message_id' => 888,
            'chat' => ['id' => '-100111'],
            'photo' => [['file_id' => 'photo_id']],
            'caption' => 'Order',
        ];

        $order = $processor->process($shopA->id, $messageData);

        $this->assertNull($order);
        $this->assertDatabaseCount('sales_orders', 0);
        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/bottest-bot-token/sendMessage') {
                return false;
            }

            return $request['chat_id'] === '-100111'
                && str_contains($request['text'], 'do not belong to this shop');
        });
    }

    public function test_notifies_user_when_stock_limit_exceeded(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create([
            'name' => 'Fashion Boutique',
            'telegram_chat_id' => '-100999888',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Limited Bag',
            'type' => 'local',
            'base_cost' => 10000,
            'retail_price' => 15000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'BAG-LTD',
            'retail_price' => 15000,
            'stock_quantity' => 1,
            'pending_stock' => 0,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/test.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/test.jpg' => Http::response('bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'Ko Aung',
                    'customer_phone' => '09123456789',
                    'delivery_address' => 'Mandalay',
                    'items' => [
                        ['product_variant_id' => $variant->id, 'quantity' => 10], // Requesting 10 when only 1 exists
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $messageData = [
            'message_id' => 999,
            'chat' => ['id' => '-100999888'],
            'photo' => [['file_id' => 'photo_id']],
            'caption' => 'Bag 10',
        ];

        $order = $processor->process($shop->id, $messageData);

        $this->assertNull($order);
        $this->assertDatabaseCount('sales_orders', 0);

        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/bottest-bot-token/sendMessage') {
                return false;
            }

            return $request['chat_id'] === '-100999888'
                && str_contains($request['text'], 'Could Not Create Order')
                && str_contains($request['text'], 'Stock limit exceeded');
        });
    }

    public function test_allows_duplicate_variants_in_items_and_consolidates_quantities(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create(['name' => 'Dupe Test Shop', 'telegram_chat_id' => '-100333']);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Lipstick',
            'type' => 'local',
            'base_cost' => 5000,
            'retail_price' => 9000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'LIP-01',
            'retail_price' => 9000,
            'stock_quantity' => 10,
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 5000,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/test.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/test.jpg' => Http::response('bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'Ko Ko',
                    'customer_phone' => '09123456789',
                    'delivery_address' => 'Yangon',
                    'items' => [
                        ['product_variant_id' => $variant->id, 'quantity' => 1],
                        ['product_variant_id' => $variant->id, 'quantity' => 2], // Same variant ID returned twice
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $order = $processor->process($shop->id, [
            'message_id' => 111,
            'chat' => ['id' => '-100333'],
            'photo' => [['file_id' => 'p1']],
            'caption' => 'Lipstick 1 and Lipstick 2',
        ]);

        $this->assertInstanceOf(SalesOrder::class, $order);
        $variant->refresh();
        $this->assertSame(7, $variant->stock_quantity); // 10 - (1 + 2) = 7
    }

    public function test_extracts_photo_from_reply_to_message_when_user_replies_with_caption(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create(['name' => 'Reply Shop', 'telegram_chat_id' => '-100444']);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Cap',
            'type' => 'local',
            'base_cost' => 3000,
            'retail_price' => 6000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'CAP-BLK',
            'retail_price' => 6000,
            'stock_quantity' => 5,
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 5,
            'remaining_quantity' => 5,
            'unit_cost' => 3000,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/replied_photo.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/replied_photo.jpg' => Http::response('bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->with('Black Cap 1')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'Ma Ma',
                    'customer_phone' => '09999888777',
                    'delivery_address' => 'Mandalay',
                    'items' => [
                        ['product_variant_id' => $variant->id, 'quantity' => 1],
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        // User sent text "Black Cap 1" replying to message 50 which had the photo
        $messageData = [
            'message_id' => 51,
            'chat' => ['id' => '-100444'],
            'text' => 'Black Cap 1',
            'reply_to_message' => [
                'message_id' => 50,
                'photo' => [['file_id' => 'replied_photo_id']],
            ],
        ];

        $order = $processor->process($shop->id, $messageData);
        $this->assertInstanceOf(SalesOrder::class, $order);
        $this->assertSame('Ma Ma', $order->customer_name);
    }

    public function test_deduplicates_telegram_media_group_albums(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create(['name' => 'Album Shop', 'telegram_chat_id' => '-100555']);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Dress',
            'type' => 'local',
            'base_cost' => 10000,
            'retail_price' => 20000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'DRS-01',
            'retail_price' => 20000,
            'stock_quantity' => 10,
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 10000,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/album.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/album.jpg' => Http::response('bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once()) // Only called ONCE, not twice!
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'Customer',
                    'customer_phone' => '09123456789',
                    'delivery_address' => 'Yangon',
                    'items' => [['product_variant_id' => $variant->id, 'quantity' => 1]],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        // Photo 1 in media group: has caption
        $order1 = $processor->process($shop->id, [
            'message_id' => 10,
            'media_group_id' => 'group-999',
            'chat' => ['id' => '-100555'],
            'photo' => [['file_id' => 'photo_1']],
            'caption' => 'Dress 1',
        ]);

        // Photo 2 in media group: no caption
        $order2 = $processor->process($shop->id, [
            'message_id' => 11,
            'media_group_id' => 'group-999',
            'chat' => ['id' => '-100555'],
            'photo' => [['file_id' => 'photo_2']],
        ]);

        $this->assertInstanceOf(SalesOrder::class, $order1);
        $this->assertNull($order2); // Photo 2 ignored, no duplicate order!
        $this->assertDatabaseCount('sales_orders', 1);
    }

    public function test_groups_multi_batch_fifo_splits_in_telegram_summary_message(): void
    {
        Config::set('app.url', 'https://shop.example.com');
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create(['name' => 'Batch Shop', 'telegram_chat_id' => '-100666', 'currency_code' => 'MMK']);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Silk Shirt',
            'type' => 'local',
            'base_cost' => 1000,
            'retail_price' => 3000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'SILK-M',
            'retail_price' => 3000,
            'stock_quantity' => 10,
        ]);

        // Two batches of 3 each
        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 3,
            'remaining_quantity' => 3,
            'unit_cost' => 1000,
            'created_at' => now()->subDay(),
        ]);
        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 5,
            'remaining_quantity' => 5,
            'unit_cost' => 1200,
            'created_at' => now(),
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/test.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/test.jpg' => Http::response('bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response(['ok' => true], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'Aung Aung',
                    'customer_phone' => '09123456789',
                    'delivery_address' => 'Yangon',
                    'items' => [
                        ['product_variant_id' => $variant->id, 'quantity' => 5], // Will deplete Batch 1 (3) + Batch 2 (2)
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $order = $processor->process($shop->id, [
            'message_id' => 201,
            'chat' => ['id' => '-100666'],
            'photo' => [['file_id' => 'p_batch']],
            'caption' => 'Silk Shirt 5',
        ]);

        $this->assertInstanceOf(SalesOrder::class, $order);
        $this->assertCount(2, $order->items); // Split across 2 batches in database

        // But in the Telegram message, grouped into a single combined line: "Silk Shirt (SILK-M) × 5"
        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/bottest-bot-token/sendMessage') {
                return false;
            }

            $text = $request['text'];

            return str_contains($text, '• Silk Shirt (SILK-M) × 5 (3,000 MMK)')
                && substr_count($text, 'Silk Shirt (SILK-M)') === 1;
        });
    }

    public function test_plain_group_chat_messages_do_not_spam_warning(): void
    {
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create(['name' => 'Quiet Shop', 'telegram_chat_id' => '-100777']);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->never())->method('parseOrder');

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        // Group chat message with empty caption/text or casual chat
        $messageData = [
            'message_id' => 301,
            'chat' => ['id' => '-100777', 'type' => 'supergroup'],
            'text' => '',
        ];

        $order = $processor->process($shop->id, $messageData);

        $this->assertNull($order);
        Http::assertNothingSent();
    }

    public function test_processes_prepaid_order_records_payment_and_formats_telegram_summary_with_remaining_cod(): void
    {
        Config::set('app.url', 'https://shop.example.com');
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create([
            'name' => 'Fashion Shop',
            'currency_code' => 'MMK',
            'telegram_chat_id' => '-100888999',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Dress',
            'type' => 'local',
            'base_cost' => 8000,
            'retail_price' => 15000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'DRS-RED',
            'retail_price' => 15000,
            'stock_quantity' => 10,
            'pending_stock' => 0,
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 8000,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/prepaid.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/prepaid.jpg' => Http::response('image-bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 888],
            ], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'ဒေါ်နွယ်နွယ်',
                    'customer_phone' => '0911223344',
                    'delivery_address' => 'မင်္ဂလာဒုံ၊ ရန်ကုန်',
                    'delivery_notes' => '',
                    'paid_amount' => 12000.0,
                    'items' => [
                        ['product_variant_id' => $variant->id, 'quantity' => 1],
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $order = $processor->process($shop->id, [
            'message_id' => 500,
            'chat' => ['id' => '-100888999'],
            'photo' => [['file_id' => 'prepaid_file_id']],
            'caption' => 'Dress Red 1 prepaid - 12000',
        ]);

        $this->assertInstanceOf(SalesOrder::class, $order);
        $this->assertSame(15000.0, (float) $order->customer_grand_total);
        $this->assertSame(12000.0, (float) $order->paid_amount);
        $this->assertCount(1, $order->payments);
        $this->assertSame(12000.0, (float) $order->payments->first()->amount);

        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/bottest-bot-token/sendMessage') {
                return false;
            }

            $text = $request['text'];

            return str_contains($text, '💰 <b>Total:</b> <b>15,000 MMK</b>')
                && str_contains($text, '💳 <b>Prepaid:</b> <b>12,000 MMK</b>')
                && str_contains($text, '💵 <b>Remaining COD:</b> <b>3,000 MMK</b>');
        });
    }

    public function test_processes_fully_paid_order_and_formats_telegram_summary_as_fully_paid(): void
    {
        Config::set('app.url', 'https://shop.example.com');
        Config::set('services.telegram.bot_token', 'test-bot-token');

        $shop = Shop::create([
            'name' => 'Fashion Shop',
            'currency_code' => 'MMK',
            'telegram_chat_id' => '-100888999',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Dress',
            'type' => 'local',
            'base_cost' => 8000,
            'retail_price' => 15000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'DRS-RED',
            'retail_price' => 15000,
            'stock_quantity' => 10,
            'pending_stock' => 0,
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 8000,
        ]);

        Http::fake([
            'https://api.telegram.org/bottest-bot-token/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/paid.jpg'],
            ], 200),
            'https://api.telegram.org/file/bottest-bot-token/photos/paid.jpg' => Http::response('image-bytes', 200),
            'https://api.telegram.org/bottest-bot-token/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 889],
            ], 200),
        ]);

        $mockParser = $this->createMock(AiAddressParserService::class);
        $mockParser->expects($this->once())
            ->method('parseOrder')
            ->willReturn([
                'success' => true,
                'data' => [
                    'customer_name' => 'ဒေါ်နွယ်နွယ်',
                    'customer_phone' => '0911223344',
                    'delivery_address' => 'မင်္ဂလာဒုံ၊ ရန်ကုန်',
                    'delivery_notes' => '',
                    'paid_amount' => 15000.0,
                    'items' => [
                        ['product_variant_id' => $variant->id, 'quantity' => 1],
                    ],
                ],
            ]);

        $processor = new TelegramOrderProcessorService(
            new TelegramService,
            $mockParser,
            new SalesOrderService
        );

        $order = $processor->process($shop->id, [
            'message_id' => 501,
            'chat' => ['id' => '-100888999'],
            'photo' => [['file_id' => 'fully_paid_file_id']],
            'caption' => 'Dress Red 1 paid 15000',
        ]);

        $this->assertInstanceOf(SalesOrder::class, $order);
        $this->assertSame(15000.0, (float) $order->paid_amount);

        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/bottest-bot-token/sendMessage') {
                return false;
            }

            $text = $request['text'];

            return str_contains($text, '💰 <b>Total:</b> <b>15,000 MMK</b>')
                && str_contains($text, '💳 <b>Paid:</b> <b>15,000 MMK</b> (Fully Paid)')
                && ! str_contains($text, 'Remaining COD');
        });
    }
}
