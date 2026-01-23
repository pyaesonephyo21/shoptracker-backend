<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'batch_name' => 'required|string|max:255',
            'supplier_id' => 'nullable|exists:suppliers,id', // New

            // Financials
            'exchange_rate' => 'required|numeric|min:0.0001', // Default 1 for local
            'supplier_fee' => 'nullable|numeric|min:0',
            'cargo_fee' => 'nullable|numeric|min:0',
            'local_deli_fee' => 'nullable|numeric|min:0',

            // Payment (Initial Deposit)
            'paid_amount' => 'nullable|numeric|min:0',

            'note' => 'nullable|string',

            // Items
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0', // This can be CNY or MMK
        ];
    }
}
