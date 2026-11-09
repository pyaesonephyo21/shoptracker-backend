<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $shopId = $this->user()?->shop_id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(function ($query) use ($shopId) {
                    $query->where('shop_id', $shopId);
                }),
            ],
            'type' => ['required', 'in:local,global'],
            'base_cost' => ['nullable', 'numeric', 'min:0'],
            'retail_price' => ['nullable', 'numeric', 'min:0'],
            'variant_options' => ['nullable', 'array'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.sku' => ['nullable', 'string', 'max:255', 'unique:product_variants,sku'],
            'variants.*.attributes' => ['nullable', 'array'],
            'variants.*.retail_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
