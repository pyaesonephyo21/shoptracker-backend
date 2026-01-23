<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'type' => 'required|in:foreign,local',
            'currency' => 'required|in:MMK,CNY,THB,USD',
            'contact_info' => 'nullable|string',
            'address' => 'nullable|string',
        ];
    }
}
