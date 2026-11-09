<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FulfillSalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $shopId = $this->user()?->shop_id;

        return [
            'courier_id' => [
                'required',
                Rule::exists('couriers', 'id')->where(function ($query) use ($shopId) {
                    $query->where('shop_id', $shopId);
                }),
            ],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'courier_service_fee' => ['nullable', 'numeric', 'min:0'],
            'overcharge' => ['nullable', 'numeric', 'min:0'],
            'delivery_note' => ['nullable', 'string'],
            'money_collected_by' => ['required', 'in:seller,courier'],
            'is_deli_prepaid' => ['boolean'],
        ];
    }
}
