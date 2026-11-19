<?php

namespace App\Http\Requests;

use App\Enums\Square;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAlertResponseRequest extends FormRequest
{
    /**
     * Permission is enforced by the `can:submit-locations` route middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'square' => ['required', 'string', Rule::enum(Square::class)],
        ];
    }
}
