<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSalesOrderRequest extends FormRequest
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
            'cart' => ['required', 'array', 'min:1'],
            'cart.*.product_variant_id' => [
                'required',
                Rule::exists('product_variants', 'id')->where(function ($query) {
                    $query->whereIn('product_id', Product::select('id'));
                }),
            ],
            'cart.*.quantity' => ['required', 'integer', 'min:1'],
            'cart.*.discount_type' => ['nullable', 'in:none,fixed,percent'],
            'cart.*.discount_value' => ['nullable', 'numeric', 'min:0'],
            'cart.*.discount_reason' => ['nullable', 'string', 'max:255'],
            'discount_type' => ['nullable', 'in:none,fixed,percent'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:50'],
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
            'delivery_note' => ['nullable', 'string'],
            'money_collected_by' => ['nullable', 'in:seller,courier'],
            'is_deli_prepaid' => ['nullable', 'boolean'],
        ];
    }

    public function toOrderData(): array
    {
        $validated = $this->validated();

        return [
            'customer_name' => $validated['customer_name'] ?? 'Walk-in',
            'customer_phone' => $validated['customer_phone'] ?? '',
            'delivery_address' => $validated['delivery_address'] ?? '',
            'discount_type' => $validated['discount_type'] ?? 'none',
            'discount_value' => $validated['discount_value'] ?? 0,
            'discount_reason' => $validated['discount_reason'] ?? '',
            'extra_fee' => $validated['extra_fee'] ?? 0,
            'note' => $validated['note'] ?? '',
            'delivery_note' => $validated['delivery_note'] ?? '',
            'paid_amount' => $validated['paid_amount'] ?? 0,
            'payment_method' => $validated['payment_method'] ?? 'cash',
            'courier_id' => $validated['courier_id'] ?? null,
            'tracking_number' => $validated['tracking_number'] ?? null,
            'delivery_fee' => $validated['delivery_fee'] ?? 0,
            'courier_service_fee' => $validated['courier_service_fee'] ?? 0,
            'overcharge' => $validated['overcharge'] ?? 0,
            'money_collected_by' => $validated['money_collected_by'] ?? 'courier',
            'is_deli_prepaid' => (bool) ($validated['is_deli_prepaid'] ?? false),
        ];
    }

    public function cartItems(): array
    {
        return $this->validated('cart', []);
    }
}
