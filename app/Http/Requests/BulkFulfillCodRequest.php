<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkFulfillCodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => [
                'required',
                'integer',
                Rule::exists('sales_orders', 'id')->where(function ($query) {
                    $query->where('shop_id', $this->user()->shop_id);
                }),
            ],
            'courier_id' => [
                'required',
                'integer',
                Rule::exists('couriers', 'id')->where(function ($query) {
                    $query->where('shop_id', $this->user()->shop_id);
                }),
            ],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'courier_service_fee' => ['nullable', 'numeric', 'min:0'],
            'overcharge' => ['nullable', 'numeric', 'min:0'],
            'delivery_note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
