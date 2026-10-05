<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $product = $this->route('product');
        $variantId = $this->input('product_variant_id');
        $isAdd = $this->input('action_type') === 'add';
        $isExistingBatch = $this->input('batch_pricing_mode') === 'existing';

        return [
            'product_variant_id' => [
                'required',
                'integer',
                Rule::exists('product_variants', 'id')->where(function ($query) use ($product) {
                    if ($product) {
                        $query->where('product_id', $product->id);
                    }
                }),
            ],
            'action_type' => ['required', 'in:add,remove'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'in:damage,loss,return,correction'],
            'note' => ['nullable', 'string', 'max:1000'],
            'batch_pricing_mode' => ['nullable', 'in:default,existing,new'],
            'selected_batch_id' => [
                Rule::requiredIf($isAdd && $isExistingBatch),
                'nullable',
                'integer',
                Rule::exists('product_batches', 'id')->where(function ($query) use ($variantId) {
                    if ($variantId) {
                        $query->where('product_variant_id', $variantId);
                    }
                }),
            ],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'retail_price' => ['nullable', 'numeric', 'min:0'],
            'update_variant_retail_price' => ['nullable', 'boolean'],
        ];
    }
}
