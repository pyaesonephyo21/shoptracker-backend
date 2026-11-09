<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MarkPurchaseOrderArrivedRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $purchaseOrder = $this->route('purchaseOrder');
        $poId = $purchaseOrder ? $purchaseOrder->id : null;

        return [
            'cargo_fee' => ['nullable', 'numeric', 'min:0'],
            'local_deli_fee' => ['nullable', 'numeric', 'min:0'],
            'adjustment_amount' => ['nullable', 'numeric'],
            'adjustment_reason' => ['nullable', 'string', 'required_with:adjustment_amount'],
            'received_items' => ['required', 'array'],
            'received_items.*.id' => [
                'required',
                Rule::exists('purchase_order_items', 'id')->where(function ($query) use ($poId) {
                    if ($poId) {
                        $query->where('purchase_order_id', $poId);
                    }
                }),
            ],
            'received_items.*.received_quantity' => ['nullable', 'integer', 'min:0'],
            'received_items.*.retail_price' => ['nullable', 'numeric', 'min:0'],
            'received_items.*.allocated_cargo_fee' => ['nullable', 'numeric'],
            'received_items.*.allocated_adjustment_amount' => ['nullable', 'numeric'],
        ];
    }
}
