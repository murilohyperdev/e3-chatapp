<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadAvatarRequest extends FormRequest
{
    /**
     * Runs before validation: another user's picture is always 403.
     */
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('user'));
    }

    /**
     * SVG is excluded on purpose (it can embed scripts). `mimes` checks the real
     * file content, not only the extension.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'avatar' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:2048', // kilobytes
                'dimensions:min_width=64,min_height=64,max_width=4096,max_height=4096',
            ],
        ];
    }
}
