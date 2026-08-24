<?php

namespace App\Services;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            // 1. Create the Shop
            $shop = Shop::create(['name' => $data['shop_name']]);

            // 2. Create the Owner User
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'shop_id' => $shop->id,
                'role' => 'owner', // Force role to owner
            ]);

            // 3. Issue Token immediately
            $token = $user->createToken($data['device_name'])->plainTextToken;

            return [
                'user' => $user->load('shop'),
                'token' => $token,
            ];
        });
    }

    public function login(string $email, string $password, string $deviceName): array
    {
        // 1. Find User
        $user = User::where('email', $email)->first();

        // 2. Business Logic: Verify Password
        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // 4. Issue Token
        $token = $user->createToken($deviceName)->plainTextToken;

        return [
            'user' => $user->load('shop'),
            'token' => $token,
        ];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();
    }
}
