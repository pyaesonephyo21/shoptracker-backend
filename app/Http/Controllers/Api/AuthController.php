<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthService; // <--- Import Service
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        protected AuthService $authService
    ) {}

    public function register(RegisterRequest $request)
    {
        // 2. Call Service
        $data = $this->authService->register($request->validated());

        // 3. Return Response
        return response()->json([
            'message' => 'Shop registered successfully',
            'token' => $data['token'],
            'user' => $data['user'],
        ], 201);
    }

    public function login(Request $request)
    {
        // 1. Validate Input (Controller Job)
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
            'device_name' => 'required|string',
        ]);

        // 2. Call Service (Business Logic)
        $data = $this->authService->login(
            $request->email,
            $request->password,
            $request->device_name
        );

        // 3. Return Response (Controller Job)
        return response()->json([
            'message' => 'Login successful',
            'token' => $data['token'],
            'user' => $data['user'],
        ]);
    }

    public function logout(Request $request)
    {
        $this->authService->logout($request->user());

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        return $request->user()->load('shop');
    }
}
