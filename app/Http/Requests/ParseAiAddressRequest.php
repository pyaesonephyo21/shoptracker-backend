<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ParseAiAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'text' => ['required_without_all:image,image_base64', 'nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'file', 'image', 'max:10240'],
            'image_base64' => ['nullable', 'string'],
            'image_mime' => ['nullable', 'string', 'max:50'],
        ];
    }
}

