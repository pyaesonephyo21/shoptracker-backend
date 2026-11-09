<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\User;
use App\Services\TelegramService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class TelegramSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_authenticated_user_can_view_telegram_settings_page(): void
    {
        $shop = Shop::create(['name' => 'Fashion Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->get('/management/telegram');

        $response->assertOk();
        $this->assertNotEmpty($shop->fresh()->telegram_webhook_secret);
    }

    public function test_authenticated_user_can_update_telegram_credentials(): void
    {
        $shop = Shop::create(['name' => 'Fashion Shop']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->put('/management/telegram', [
            'telegram_bot_token' => '123456789:ABCdefGHI',
            'telegram_chat_id' => '-100987654321',
        ]);

        $response->assertRedirect();
        $this->assertSame('123456789:ABCdefGHI', $shop->fresh()->telegram_bot_token);
        $this->assertSame('-100987654321', $shop->fresh()->telegram_chat_id);
    }

    public function test_register_webhook_endpoint_calls_telegram_service(): void
    {
        $shop = Shop::create([
            'name' => 'Fashion Shop',
            'telegram_bot_token' => '123456789:ABCdefGHI',
            'telegram_webhook_secret' => 'shop_secret_123',
        ]);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $this->mock(TelegramService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('setWebhook')
                ->once()
                ->andReturn(['ok' => true, 'result' => true]);
        });

        $response = $this->actingAs($user)->post('/management/telegram/register-webhook');

        $response->assertRedirect();
        $response->assertSessionHas('success');
    }

    public function test_test_connection_endpoint_calls_telegram_get_me(): void
    {
        $shop = Shop::create([
            'name' => 'Fashion Shop',
            'telegram_bot_token' => '123456789:ABCdefGHI',
        ]);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $this->mock(TelegramService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('getMe')
                ->once()
                ->with('123456789:ABCdefGHI')
                ->andReturn([
                    'ok' => true,
                    'result' => [
                        'first_name' => 'ShopTrackerBot',
                        'username' => 'shoptracker_bot',
                    ],
                ]);
        });

        $response = $this->actingAs($user)->post('/management/telegram/test-connection');

        $response->assertRedirect();
        $response->assertSessionHas('success');
    }
}
