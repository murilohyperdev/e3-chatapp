<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    /**
     * Authorization runs before validation, so editing someone else's profile is
     * always 403, never a 422 that reveals anything about the target.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('user'));
    }

    /**
     * Only these fields are ever read (via validated()), so email and role in the
     * payload are ignored.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^\+?[0-9 ()\-]{7,20}$/'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['phone.regex' => 'The phone may only contain digits, spaces, parentheses, dashes and a leading +.'];
    }
}
