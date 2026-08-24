<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('The pdo_sqlite extension is not available in the current PHP environment.');
        }

        parent::setUp();
    }

    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $shop = Shop::create([
            'name' => 'Main Test Store',
        ]);

        $user = User::factory()->create([
            'shop_id' => $shop->id,
            'email' => 'admin@shoptracker.local',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->post('/login', [
            'email' => 'admin@shoptracker.local',
            'password' => 'password123',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/');
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $shop = Shop::create([
            'name' => 'Main Test Store',
        ]);

        $user = User::factory()->create([
            'shop_id' => $shop->id,
            'email' => 'admin@shoptracker.local',
            'password' => bcrypt('password123'),
        ]);

        $this->post('/login', [
            'email' => 'admin@shoptracker.local',
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_authenticated_user_can_logout(): void
    {
        $shop = Shop::create([
            'name' => 'Main Test Store',
        ]);

        $user = User::factory()->create([
            'shop_id' => $shop->id,
        ]);

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/login');
    }
}
