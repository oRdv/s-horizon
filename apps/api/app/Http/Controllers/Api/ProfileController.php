<?php

namespace App\Http\Controllers\Api;

use App\Enums\SecurityTokenPurpose;
use App\Enums\UserRole;
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
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'user' => $user->loadMissing('boosterProfile'),
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
            'booster_profile' => ['sometimes', 'array'],
            'booster_profile.discord_username' => ['nullable', 'string', 'max:120'],
            'booster_profile.discord_user_id' => ['nullable', 'string', 'regex:/^\d{15,32}$/', Rule::unique('booster_profiles', 'discord_user_id')->ignore($user->boosterProfile?->getKey())],
            'password' => ['sometimes', 'confirmed', Password::min(8)],
        ]);

        if (array_key_exists('booster_profile', $validated) && ! $user->hasRole(UserRole::Booster)) {
            return response()->json([
                'message' => 'Somente boosters podem vincular conta Discord ao perfil.',
            ], 403);
        }

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

        if (array_key_exists('booster_profile', $payload) && $user->hasRole(UserRole::Booster)) {
            $profilePayload = $payload['booster_profile'] ?? [];
            $user->boosterProfile()->updateOrCreate(
                ['user_id' => $user->getKey()],
                [
                    'discord_username' => $profilePayload['discord_username'] ?? null,
                    'discord_user_id' => $profilePayload['discord_user_id'] ?? null,
                ],
            );
        }

        $audit->record('profile.change_confirmed', $user, $user, $request, $user, [
            'purpose' => $purpose->value,
            'fields' => array_keys(array_merge($updates, $payload['booster_profile'] ?? [])),
        ]);

        return response()->json([
            'message' => 'Perfil atualizado com segurança.',
            'data' => [
                'user' => $user->refresh()->loadMissing('boosterProfile'),
            ],
        ]);
    }
}
