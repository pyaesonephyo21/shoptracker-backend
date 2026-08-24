<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
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
}
