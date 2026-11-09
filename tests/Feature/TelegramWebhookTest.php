<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\ProcessTelegramOrderJob;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\Shop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_webhook_rejects_unauthorized_token(): void
    {
        Config::set('services.telegram.webhook_secret', 'correct-secret-123');

        $response = $this->postJson('/api/telegram/webhook/wrong-secret', [
            'update_id' => 1,
            'message' => [
                'message_id' => 10,
                'chat' => ['id' => '-100123'],
                'text' => 'Hello',
            ],
        ]);

        $response->assertStatus(401)
            ->assertJson(['error' => 'Unauthorized']);
    }

    public function test_webhook_accepts_valid_global_secret_and_dispatches_job_after_response(): void
    {
        Config::set('services.telegram.webhook_secret', 'correct-secret-123');
        Bus::fake();

        $shop = Shop::create([
            'name' => 'Test Boutique',
            'telegram_chat_id' => '-100555666',
        ]);

        $payload = [
            'update_id' => 100,
            'message' => [
                'message_id' => 42,
                'chat' => ['id' => '-100555666'],
                'photo' => [['file_id' => 'photo_xyz', 'width' => 600]],
                'caption' => 'Cotton T-shirt Red M 1',
            ],
        ];

        $response = $this->postJson('/api/telegram/webhook/correct-secret-123', $payload);

        $response->assertStatus(200)
            ->assertJson(['ok' => true]);

        Bus::assertDispatchedAfterResponse(ProcessTelegramOrderJob::class, function ($job) use ($shop) {
            return $job->shopId === $shop->id
                && $job->messageData['caption'] === 'Cotton T-shirt Red M 1';
        });
    }

    public function test_webhook_accepts_shop_specific_secret(): void
    {
        Config::set('services.telegram.webhook_secret', null);
        Bus::fake();

        $shop = Shop::create([
            'name' => 'Custom Shop',
            'telegram_chat_id' => '-100777888',
            'telegram_webhook_secret' => 'shop-private-secret-999',
        ]);

        $payload = [
            'update_id' => 101,
            'message' => [
                'message_id' => 43,
                'chat' => ['id' => '-100777888'],
                'photo' => [['file_id' => 'photo_abc', 'width' => 600]],
                'caption' => 'Silk Dress 1',
            ],
        ];

        $response = $this->postJson('/api/telegram/webhook/shop-private-secret-999', $payload);

        $response->assertStatus(200)
            ->assertJson(['ok' => true]);

        Bus::assertDispatchedAfterResponse(ProcessTelegramOrderJob::class, function ($job) use ($shop) {
            return $job->shopId === $shop->id;
        });
    }

    public function test_webhook_returns_ok_for_non_message_updates_without_dispatching(): void
    {
        Config::set('services.telegram.webhook_secret', 'webhook-token');
        Bus::fake();

        $response = $this->postJson('/api/telegram/webhook/webhook-token', [
            'update_id' => 999,
        ]);

        $response->assertStatus(200)
            ->assertJson(['ok' => true]);

        Bus::assertNotDispatched(ProcessTelegramOrderJob::class);
    }

    public function test_end_to_end_telegram_webhook_processes_photo_and_creates_sales_order(): void
    {
        Config::set('app.url', 'https://shop.example.com');
        Config::set('services.telegram.webhook_secret', 'my-telegram-secret');
        Config::set('services.telegram.bot_token', 'bot-token-xyz');
        Config::set('services.gemini.api_key', 'gemini-key-xyz');

        $shop = Shop::create([
            'name' => 'Lotus Fashion',
            'currency_code' => 'MMK',
            'telegram_chat_id' => '-10011223344',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Cotton T-shirt',
            'type' => 'local',
            'base_cost' => 10000,
            'retail_price' => 18000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'TSH-RED-M',
            'retail_price' => 18000,
            'stock_quantity' => 10,
            'pending_stock' => 0,
            'attributes' => ['Color' => 'Red', 'Size' => 'M'],
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 10000,
        ]);

        Http::fake([
            'https://api.telegram.org/botbot-token-xyz/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/customer_chat.jpg'],
            ], 200),
            'https://api.telegram.org/file/botbot-token-xyz/photos/customer_chat.jpg' => Http::response('fake-binary-image', 200),
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မဖြူဖြူသင်း',
                                    'customer_phone' => '09250123456',
                                    'delivery_address' => 'အမှတ် ၂၅၊ လှည်းတန်းလမ်း၊ ကမာရွတ်မြို့နယ်၊ ရန်ကုန်',
                                    'delivery_notes' => 'ညနေ ၅ နာရီနောက်ပိုင်းပို့ပါ',
                                    'items' => [
                                        [
                                            'product_variant_id' => $variant->id,
                                            'quantity' => 1,
                                        ],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
            'https://api.telegram.org/botbot-token-xyz/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 909],
            ], 200),
        ]);

        $payload = [
            'update_id' => 200,
            'message' => [
                'message_id' => 88,
                'chat' => ['id' => '-10011223344'],
                'photo' => [
                    ['file_id' => 'thumb_id', 'width' => 100],
                    ['file_id' => 'large_photo_id', 'width' => 1000],
                ],
                'caption' => 'Cotton T-shirt Red M 1',
            ],
        ];

        // Do NOT Bus::fake() so dispatchAfterResponse executes upon termination
        $response = $this->postJson('/api/telegram/webhook/my-telegram-secret', $payload);

        $response->assertStatus(200)
            ->assertJson(['ok' => true]);

        // Verify order created in database
        $this->assertDatabaseHas('sales_orders', [
            'shop_id' => $shop->id,
            'customer_name' => 'မဖြူဖြူသင်း',
            'customer_phone' => '09250123456',
            'delivery_address' => 'အမှတ် ၂၅၊ လှည်းတန်းလမ်း၊ ကမာရွတ်မြို့နယ်၊ ရန်ကုန်',
            'delivery_note' => 'ညနေ ၅ နာရီနောက်ပိုင်းပို့ပါ',
            'customer_grand_total' => 18000,
        ]);

        $this->assertDatabaseHas('sales_order_items', [
            'product_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => 18000,
        ]);

        // Variant stock decremented
        $variant->refresh();
        $this->assertSame(9, $variant->stock_quantity);

        // Telegram reply sent with direct order URL
        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/botbot-token-xyz/sendMessage') {
                return false;
            }

            $text = $request['text'];

            return $request['chat_id'] === '-10011223344'
                && $request['reply_to_message_id'] === 88
                && str_contains($text, 'Order Created Successfully')
                && str_contains($text, 'မဖြူဖြူသင်း')
                && str_contains($text, '09250123456')
                && str_contains($text, 'TSH-RED-M')
                && str_contains($text, 'https://shop.example.com/sales/');
        });
    }

    public function test_shop_specific_secret_rejects_mismatched_chat_id_to_prevent_idor(): void
    {
        Config::set('services.telegram.webhook_secret', null);
        Bus::fake();

        $shopA = Shop::create([
            'name' => 'Shop A',
            'telegram_chat_id' => '-100111',
            'telegram_webhook_secret' => 'shop-a-secret',
        ]);

        $shopB = Shop::create([
            'name' => 'Shop B',
            'telegram_chat_id' => '-100222',
            'telegram_webhook_secret' => 'shop-b-secret',
        ]);

        // Attempting to send a message targeting Shop B's chat using Shop A's secret URL
        $payload = [
            'update_id' => 999,
            'message' => [
                'message_id' => 123,
                'chat' => ['id' => '-100222'],
                'photo' => [['file_id' => 'xyz']],
                'caption' => 'Order Item 1',
            ],
        ];

        $response = $this->postJson('/api/telegram/webhook/shop-a-secret', $payload);

        $response->assertStatus(200);
        Bus::assertNotDispatched(ProcessTelegramOrderJob::class);
    }

    public function test_plain_chat_message_in_group_does_not_dispatch_job(): void
    {
        Config::set('services.telegram.webhook_secret', 'secret-abc');
        Bus::fake();

        $shop = Shop::create([
            'name' => 'Active Shop',
            'telegram_chat_id' => '-100888',
        ]);

        $payload = [
            'update_id' => 12,
            'message' => [
                'message_id' => 456,
                'chat' => ['id' => '-100888', 'type' => 'supergroup'],
                'text' => 'Good morning team! How is sales today?',
            ],
        ];

        $response = $this->postJson('/api/telegram/webhook/secret-abc', $payload);

        $response->assertStatus(200);
        Bus::assertNotDispatched(ProcessTelegramOrderJob::class);
    }

    public function test_end_to_end_telegram_webhook_processes_prepaid_caption_and_records_payment(): void
    {
        Config::set('app.url', 'https://shop.example.com');
        Config::set('services.telegram.webhook_secret', 'my-telegram-secret');
        Config::set('services.telegram.bot_token', 'bot-token-xyz');
        Config::set('services.gemini.api_key', 'gemini-key-xyz');

        $shop = Shop::create([
            'name' => 'Lotus Fashion',
            'currency_code' => 'MMK',
            'telegram_chat_id' => '-10011223344',
        ]);

        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Cotton T-shirt',
            'type' => 'local',
            'base_cost' => 10000,
            'retail_price' => 18000,
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'TSH-RED-M',
            'retail_price' => 18000,
            'stock_quantity' => 10,
            'pending_stock' => 0,
            'attributes' => ['Color' => 'Red', 'Size' => 'M'],
        ]);

        ProductBatch::create([
            'shop_id' => $shop->id,
            'product_variant_id' => $variant->id,
            'initial_quantity' => 10,
            'remaining_quantity' => 10,
            'unit_cost' => 10000,
        ]);

        Http::fake([
            'https://api.telegram.org/botbot-token-xyz/getFile*' => Http::response([
                'ok' => true,
                'result' => ['file_path' => 'photos/customer_chat.jpg'],
            ], 200),
            'https://api.telegram.org/file/botbot-token-xyz/photos/customer_chat.jpg' => Http::response('fake-binary-image', 200),
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မဖြူဖြူသင်း',
                                    'customer_phone' => '09250123456',
                                    'delivery_address' => 'ရန်ကုန်',
                                    'delivery_notes' => '',
                                    'paid_amount' => 10000.0,
                                    'items' => [
                                        [
                                            'product_variant_id' => $variant->id,
                                            'quantity' => 1,
                                        ],
                                    ],
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
            'https://api.telegram.org/botbot-token-xyz/sendMessage' => Http::response([
                'ok' => true,
                'result' => ['message_id' => 910],
            ], 200),
        ]);

        $payload = [
            'update_id' => 201,
            'message' => [
                'message_id' => 89,
                'chat' => ['id' => '-10011223344'],
                'photo' => [
                    ['file_id' => 'large_photo_id', 'width' => 1000],
                ],
                'caption' => 'Cotton T-shirt Red M 1 prepaid - 10000',
            ],
        ];

        $response = $this->postJson('/api/telegram/webhook/my-telegram-secret', $payload);

        $response->assertStatus(200)
            ->assertJson(['ok' => true]);

        $this->assertDatabaseHas('sales_orders', [
            'shop_id' => $shop->id,
            'customer_name' => 'မဖြူဖြူသင်း',
            'paid_amount' => 10000.0,
        ]);

        Http::assertSent(function ($request) {
            if ($request->url() !== 'https://api.telegram.org/botbot-token-xyz/sendMessage') {
                return false;
            }

            $text = $request['text'];

            return str_contains($text, '💰 <b>Total:</b> <b>18,000 MMK</b>')
                && str_contains($text, '💳 <b>Prepaid:</b> <b>10,000 MMK</b>')
                && str_contains($text, '💵 <b>Remaining COD:</b> <b>8,000 MMK</b>');
        });
    }
}
