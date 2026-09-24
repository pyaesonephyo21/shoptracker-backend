<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiAddressParserTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_ai_parser_requires_authentication(): void
    {
        $response = $this->postJson('/api/ai/parse-address', [
            'text' => 'Some Myanmar address text',
        ]);

        $response->assertStatus(401);
    }

    public function test_ai_parser_validates_text_field(): void
    {
        $shop = Shop::create(['name' => 'Store']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->postJson('/api/ai/parse-address', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['text']);
    }

    public function test_ai_parser_returns_friendly_message_when_no_api_key_configured(): void
    {
        Config::set('services.gemini.api_key', null);
        Config::set('services.openrouter.api_key', null);

        $shop = Shop::create(['name' => 'Store']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->postJson('/api/ai/parse-address', [
            'text' => 'ကိုမောင်မောင် 09123456789 ရန်ကုန်',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => false,
                'reason' => 'no_api_key',
            ]);
    }

    public function test_ai_parser_parses_successful_response(): void
    {
        Config::set('services.gemini.api_key', 'test-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => json_encode([
                                    'customer_name' => 'မအိမ့်မှူးခင်',
                                    'customer_phone' => '09772775937',
                                    'address' => 'ရန်ကုန်',
                                    'delivery_notes' => '',
                                ])],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $shop = Shop::create(['name' => 'Store']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->postJson('/api/ai/parse-address', [
            'text' => 'မအိမ့်မှူးခင် 09772775937 ရန်ကုန်',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'customer_name' => 'မအိမ့်မှူးခင်',
                    'customer_phone' => '09772775937',
                    'address' => 'ရန်ကုန်',
                ],
            ]);
    }

    public function test_ai_parser_falls_back_to_openrouter_on_gemini_timeout(): void
    {
        Config::set('services.gemini.api_key', 'test-gemini-key');
        Config::set('services.openrouter.api_key', 'test-openrouter-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/*' => function () {
                throw new ConnectionException('cURL error 28: Operation timed out after 4001 milliseconds with 0 bytes received');
            },
            'https://openrouter.ai/*' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => json_encode([
                                'customer_name' => 'မအိမ့်မှူးခင်',
                                'customer_phone' => '09772775937',
                                'address' => 'ရန်ကုန်',
                                'delivery_notes' => '',
                            ]),
                        ],
                    ],
                ],
            ], 200),
        ]);

        $shop = Shop::create(['name' => 'Store']);
        $user = User::factory()->create(['shop_id' => $shop->id]);

        $response = $this->actingAs($user)->postJson('/api/ai/parse-address', [
            'text' => 'မအိမ့်မှူးခင် 09772775937 ရန်ကုန်',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'customer_name' => 'မအိမ့်မှူးခင်',
                    'customer_phone' => '09772775937',
                ],
            ]);
    }
}
