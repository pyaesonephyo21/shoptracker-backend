<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $shopId = $this->user()?->shop_id;
        $product = $this->route('product');
        $productId = $product ? $product->id : null;

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
            'variants.*.id' => [
                'nullable',
                Rule::exists('product_variants', 'id')->where(function ($query) use ($productId) {
                    if ($productId) {
                        $query->where('product_id', $productId);
                    }
                }),
            ],
            'variants.*.sku' => ['nullable', 'string', 'max:255'],
            'variants.*.attributes' => ['nullable', 'array'],
            'variants.*.retail_price' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
