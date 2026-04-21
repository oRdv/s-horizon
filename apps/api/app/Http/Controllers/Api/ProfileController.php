<?php

namespace App\Http\Controllers\Api;

use App\Enums\SecurityTokenPurpose;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use App\Services\Security\AccountSecurityTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'user' => $request->user(),
            ],
        ]);
    }

    public function requestChange(Request $request, AccountSecurityTokenService $securityTokens): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'profile_photo_path' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'password' => ['sometimes', 'confirmed', Password::min(8)],
        ]);

        $purpose = array_key_exists('password', $validated)
            ? SecurityTokenPurpose::PasswordChange
            : SecurityTokenPurpose::ProfileChange;

        $issued = $securityTokens->issue(
            user: $user,
            email: $user->email,
            purpose: $purpose,
            payload: $validated,
            request: $request,
        );

        return response()->json([
            'message' => 'Enviamos um token para confirmar a alteração.',
            'data' => [
                'security' => $securityTokens->exposeForLocalDevelopment($issued),
                'purpose' => $purpose->value,
            ],
        ], 202);
    }

    public function confirmChange(
        Request $request,
        AccountSecurityTokenService $securityTokens,
        AccountAuditService $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'purpose' => ['required', Rule::in([SecurityTokenPurpose::ProfileChange->value, SecurityTokenPurpose::PasswordChange->value])],
            'token' => ['required', 'digits:6'],
        ]);

        $purpose = SecurityTokenPurpose::from($validated['purpose']);
        $record = $securityTokens->consume($user->email, $purpose, $validated['token']);
        $payload = $record->payload ?? [];

        $updates = [];

        if (array_key_exists('name', $payload)) {
            $updates['name'] = $payload['name'];
        }

        if (array_key_exists('profile_photo_path', $payload)) {
            $updates['profile_photo_path'] = $payload['profile_photo_path'];
        }

        if (array_key_exists('password', $payload)) {
            $updates['password'] = Hash::make((string) $payload['password']);
        }

        $user->forceFill($updates)->save();
        $audit->record('profile.change_confirmed', $user, $user, $request, $user, [
            'purpose' => $purpose->value,
            'fields' => array_keys($updates),
        ]);

        return response()->json([
            'message' => 'Perfil atualizado com segurança.',
            'data' => [
                'user' => $user->refresh(),
            ],
        ]);
    }
}
