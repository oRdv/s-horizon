<?php

namespace App\Http\Controllers\Api;

use App\Enums\SecurityTokenPurpose;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use App\Services\Security\AccountSecurityTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecurityController extends Controller
{
    public function requestEmailVerification(Request $request, AccountSecurityTokenService $securityTokens): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $issued = $securityTokens->issue($user, $user->email, SecurityTokenPurpose::EmailVerification, request: $request);

        return response()->json([
            'message' => 'Enviamos um token de verificação para seu e-mail.',
            'data' => [
                'security' => $securityTokens->exposeForLocalDevelopment($issued),
            ],
        ]);
    }

    public function verifyEmail(
        Request $request,
        AccountSecurityTokenService $securityTokens,
        AccountAuditService $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'token' => ['required', 'digits:6'],
        ]);

        $securityTokens->consume($user->email, SecurityTokenPurpose::EmailVerification, $validated['token']);

        $user->forceFill([
            'email_verified_at' => now(),
        ])->save();

        $audit->record('security.email_verified', $user, $user, $request, $user);

        return response()->json([
            'message' => 'E-mail verificado com sucesso.',
            'data' => [
                'user' => $user->refresh(),
            ],
        ]);
    }

    public function requestTwoFactor(Request $request, AccountSecurityTokenService $securityTokens): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $issued = $securityTokens->issue($user, $user->email, SecurityTokenPurpose::TwoFactorSetup, request: $request);

        return response()->json([
            'message' => 'Enviamos um token para ativar a autenticação em duas etapas.',
            'data' => [
                'security' => $securityTokens->exposeForLocalDevelopment($issued),
            ],
        ]);
    }

    public function confirmTwoFactor(
        Request $request,
        AccountSecurityTokenService $securityTokens,
        AccountAuditService $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'token' => ['required', 'digits:6'],
        ]);

        $securityTokens->consume($user->email, SecurityTokenPurpose::TwoFactorSetup, $validated['token']);

        $user->forceFill([
            'two_factor_enabled' => true,
            'two_factor_confirmed_at' => now(),
        ])->save();

        $audit->record('security.two_factor_enabled', $user, $user, $request, $user);

        return response()->json([
            'message' => 'Autenticação em duas etapas ativada.',
            'data' => [
                'user' => $user->refresh(),
            ],
        ]);
    }

    public function disableTwoFactor(Request $request, AccountAuditService $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->forceFill([
            'two_factor_enabled' => false,
            'two_factor_confirmed_at' => null,
        ])->save();

        $audit->record('security.two_factor_disabled', $user, $user, $request, $user);

        return response()->json([
            'message' => 'Autenticação em duas etapas desativada.',
            'data' => [
                'user' => $user->refresh(),
            ],
        ]);
    }
}
