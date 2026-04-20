<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
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
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ];
    }

    /**
     * Get custom validation messages for the register form.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Informe seu nome para criar a conta.',
            'name.max' => 'O nome precisa ter no máximo 255 caracteres.',
            'email.required' => 'Informe seu email.',
            'email.email' => 'Digite um email válido.',
            'email.unique' => 'Este email já está cadastrado. Tente entrar ou use outro email.',
            'password.required' => 'Crie uma senha.',
            'password.min' => 'A senha precisa ter pelo menos 8 caracteres.',
            'password.confirmed' => 'A confirmação da senha não confere.',
        ];
    }
}
