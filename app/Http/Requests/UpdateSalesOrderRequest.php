<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $shopId = $this->user()?->shop_id;

        return [
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'delivery_address' => ['nullable', 'string'],
            'discount_type' => ['nullable', 'in:none,fixed,percent'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'delivery_note' => ['nullable', 'string'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'extra_fee' => ['nullable', 'numeric', 'min:0'],
            'courier_id' => [
                'nullable',
                Rule::exists('couriers', 'id')->where(function ($query) use ($shopId) {
                    $query->where('shop_id', $shopId);
                }),
            ],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'courier_service_fee' => ['nullable', 'numeric', 'min:0'],
            'overcharge' => ['nullable', 'numeric', 'min:0'],
            'money_collected_by' => ['nullable', 'in:seller,courier'],
            'is_deli_prepaid' => ['nullable', 'boolean'],
        ];
    }
}
