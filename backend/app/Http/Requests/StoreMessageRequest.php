<?php

namespace App\Http\Requests;

use App\Http\Controllers\MessageController;
use Illuminate\Foundation\Http\FormRequest;

class StoreMessageRequest extends FormRequest
{
    /**
     * The `send-messages` gate is already enforced by the route's `can:` middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Laravel's TrimStrings middleware trims the text and turns an all-blank one into
     * null, so `required` also rejects a message made only of spaces.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:'.MessageController::MAX_LENGTH],
        ];
    }
}
