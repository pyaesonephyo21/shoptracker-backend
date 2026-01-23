<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Use policies if you need strict access control
    }

    public function rules(): array
    {
        return [
            // Customer Info
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'delivery_address' => 'nullable|string',

            // Logistics
            'courier_id' => 'nullable|exists:couriers,id',
            'tracking_number' => 'nullable|string|max:100',

            // MISSING FIELDS FIX: Explicitly allow these numbers
            'delivery_fee' => 'nullable|numeric|min:0',
            'courier_service_fee' => 'nullable|numeric|min:0',
            'is_deli_prepaid' => 'boolean',

            // Financials
            'payment_method' => 'required|string|in:kpay,cash,cod',
            'money_collected_by' => 'required|string|in:seller,courier',
            'paid_amount' => 'nullable|numeric|min:0', // <--- Critical for payment status

            // Discount
            'discount_type' => 'nullable|string|in:none,fixed,percent',
            'discount_value' => 'nullable|numeric|min:0',
            'discount_reason' => 'nullable|string',

            'note' => 'nullable|string',

            // Items
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ];
    }
}
