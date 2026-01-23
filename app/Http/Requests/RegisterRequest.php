<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Allow anyone to register a NEW shop (Public Sign Up)
        return true;
    }

    public function rules(): array
    {
        return [
            'shop_name' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8|confirmed',
            'device_name' => 'required|string',
        ];
    }
}
