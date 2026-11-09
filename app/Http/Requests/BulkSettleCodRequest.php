<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkSettleCodRequest extends FormRequest
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
            'payment_method' => ['required', 'string', 'max:50'],
        ];
    }
}
