<?php

namespace App\Http\Requests\Booster;

use App\Enums\MatchResult;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMatchReportRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'external_match_id' => ['nullable', 'string', 'max:80'],
            'result' => ['required', Rule::enum(MatchResult::class)],
            'duration' => ['required', 'integer', 'min:1'],
            'timestamp' => ['required', 'date'],
            'source' => ['sometimes', 'string', 'max:50'],
            'payload' => ['sometimes', 'array'],
        ];
    }
}
