<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'order_ids.*' => ['required', 'integer', 'exists:sales_orders,id'],
            'courier_id' => ['required', 'integer', 'exists:couriers,id'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'courier_service_fee' => ['nullable', 'numeric', 'min:0'],
            'overcharge' => ['nullable', 'numeric', 'min:0'],
            'delivery_note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
