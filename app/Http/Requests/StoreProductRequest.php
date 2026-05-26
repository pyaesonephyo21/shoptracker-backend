<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    // 1. Authorization
    public function authorize(): bool
    {
        // We return true because 'auth:sanctum' middleware already checks if user is logged in.
        // You could add "return $this->user()->role === 'owner';" here for extra security.
        return true;
    }

    // 2. Validation Rules
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:100',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:local,global',
            'base_cost' => 'required|numeric|min:0',
            'retail_price' => 'required|numeric|min:0',
            'image' => 'nullable|image|max:10240',
        ];
    }
}
