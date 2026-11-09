<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\PurchaseOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $shopId = $this->user()?->shop_id;

        return [
            'order_type' => ['required', 'in:local,global'],
            'batch_name' => ['nullable', 'string', 'max:255'],
            'supplier_id' => [
                'required_if:order_type,global',
                'nullable',
                Rule::exists('suppliers', 'id')->where(function ($query) use ($shopId) {
                    $query->where('shop_id', $shopId);
                }),
            ],
            'shop_name' => ['nullable', 'string', 'max:255'],
            'exchange_rate' => ['required_if:order_type,global', 'nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_variant_id' => [
                'required',
                Rule::exists('product_variants', 'id')->where(function ($query) {
                    $query->whereIn('product_id', Product::select('id'));
                }),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.retail_price' => ['nullable', 'numeric', 'min:0'],
            'foreign_deli_fee' => ['nullable', 'numeric', 'min:0'],
            'total_discount' => ['nullable', 'numeric', 'min:0'],
            'supplier_fee_percentage' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string'],
        ];
    }

    public function preparedData(): array
    {
        $validated = $this->validated();

        if (empty($validated['batch_name'])) {
            $monthPrefix = strtoupper(date('M'));
            $latestBatch = PurchaseOrder::where('batch_name', 'like', $monthPrefix.'-%')
                ->latest('id')
                ->first();

            $sequence = 1;
            if ($latestBatch && preg_match('/-(\d+)$/', $latestBatch->batch_name, $matches)) {
                $sequence = (int) $matches[1] + 1;
            }
            $validated['batch_name'] = $monthPrefix.'-'.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT);
        }

        return $validated;
    }
}
