<?php

declare(strict_types=1);

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
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:local,foreign'],
            'currency' => ['required', 'string', 'max:10'],
            'contact' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function supplierData(): array
    {
        $validated = $this->validated();

        return [
            'name' => $validated['name'],
            'type' => $validated['type'],
            'currency' => $validated['currency'],
            'contact_info' => $validated['contact'] ?? null,
        ];
    }
}
