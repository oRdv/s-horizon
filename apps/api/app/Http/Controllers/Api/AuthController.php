<?php

namespace App\Http\Controllers\Api;

use App\Enums\SecurityTokenPurpose;
use App\Enums\UserRole;
use App\Exceptions\InvalidTokenException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RefreshTokenRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\RefreshToken;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use App\Services\Auth\JwtService;
use App\Services\Auth\TokenPairService;
use App\Services\Security\AccountSecurityTokenService;
use App\Support\Auth\TokenPair;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class AuthController extends Controller
{
    public function register(
        RegisterRequest $request,
        AccountSecurityTokenService $securityTokens,
        TokenPairService $tokenPairService,
    ): JsonResponse {
        try {
            return DB::transaction(function () use ($request, $securityTokens, $tokenPairService): JsonResponse {
                $user = User::create([
                    'name' => $request->string('name')->toString(),
                    'email' => $request->string('email')->toString(),
                    'password' => Hash::make($request->string('password')->toString()),
                    'role' => UserRole::Customer->value,
                    'is_active' => true,
                ]);

                $issuedVerification = $securityTokens->issue(
                    user: $user,
                    email: $user->email,
                    purpose: SecurityTokenPurpose::EmailVerification,
                    request: $request,
                );

                $tokenPair = $tokenPairService->issueForUser($user, $request);

                return response()->json([
                    'message' => 'Conta criada com sucesso.',
                    'data' => [
                        'user' => $user,
                        'email_verification' => $securityTokens->exposeForLocalDevelopment($issuedVerification),
                    ],
                    'access_token' => $tokenPair->accessToken,
                    'refresh_token' => $tokenPair->refreshToken,
                    'token_type' => 'Bearer',
                    'expires_in' => $tokenPair->accessExpiresIn,
                    'refresh_expires_in' => $tokenPair->refreshExpiresIn,
                ], 201);
            });
        } catch (TransportExceptionInterface) {
            return response()->json([
                'message' => 'Não conseguimos enviar o e-mail agora. Verifique a configuração SMTP da Horizon Boost.',
            ], 503);
        }
    }

    public function login(
        LoginRequest $request,
        TokenPairService $tokenPairService,
        AccountSecurityTokenService $securityTokens,
    ): JsonResponse {
        $email = $request->string('email')->toString();
        $emailHash = hash('sha256', strtolower($email));

        Log::info('auth.login_attempt', [
            'email_hash' => $emailHash,
            'ip' => $request->ip(),
        ]);

        /** @var User|null $user */
        $user = User::query()
            ->where('email', $email)
            ->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            Log::warning('auth.login_invalid_credentials', [
                'email_hash' => $emailHash,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'As credenciais informadas são inválidas.',
            ], 401);
        }

        if (! $user->is_active) {
            Log::warning('auth.login_inactive_user', [
                'user_id' => $user->getKey(),
                'email_hash' => $emailHash,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'Sua conta está desativada. Fale com o suporte.',
            ], 403);
        }

        if ($user->two_factor_enabled) {
            $twoFactorCode = $request->string('two_factor_code')->toString();

            if ($twoFactorCode === '') {
                $issued = $securityTokens->issue(
                    user: $user,
                    email: $user->email,
                    purpose: SecurityTokenPurpose::TwoFactorLogin,
                    request: $request,
                    ttlMinutes: 10,
                );

                return response()->json([
                    'message' => 'Enviamos um código de autenticação em duas etapas para seu e-mail.',
                    'requires_two_factor' => true,
                    'data' => [
                        'security' => $securityTokens->exposeForLocalDevelopment($issued),
                    ],
                ], 202);
            }

            try {
                $securityTokens->consume($user->email, SecurityTokenPurpose::TwoFactorLogin, $twoFactorCode);
            } catch (ValidationException $exception) {
                throw $exception;
            }
        }

        $user->forceFill([
            'last_login_at' => CarbonImmutable::now(),
        ])->save();

        $tokenPair = $tokenPairService->issueForUser($user, $request);

        Log::info('auth.login_success', [
            'user_id' => $user->getKey(),
            'email_hash' => $emailHash,
            'ip' => $request->ip(),
        ]);

        return $this->tokenResponse($user, $tokenPair);
    }

    public function forgotPassword(Request $request, AccountSecurityTokenService $securityTokens): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = trim((string) $validated['email']);
        $user = User::query()->where('email', $email)->first();
        $issuedReset = null;

        if ($user && $user->is_active) {
            try {
                $issuedReset = $securityTokens->issue(
                    user: $user,
                    email: $user->email,
                    purpose: SecurityTokenPurpose::PasswordReset,
                    request: $request,
                    ttlMinutes: 30,
                );
            } catch (TransportExceptionInterface) {
                return response()->json([
                    'message' => 'Não conseguimos enviar o e-mail agora. Verifique a configuração SMTP da Horizon Boost.',
                ], 503);
            }
        }

        $data = [];
        if ($issuedReset && ! app()->isProduction()) {
            $data['security'] = $securityTokens->exposeForLocalDevelopment($issuedReset);
        }

        return response()->json([
            'message' => 'Se o e-mail estiver cadastrado, enviaremos um código para redefinir a senha.',
            'data' => $data,
        ]);
    }

    public function resetPassword(
        Request $request,
        AccountSecurityTokenService $securityTokens,
        AccountAuditService $audit,
    ): JsonResponse {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'digits:6'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $email = trim((string) $validated['email']);

        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        if (! $user || ! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Não foi possível redefinir a senha com os dados informados.'],
            ]);
        }

        $securityTokens->consume($user->email, SecurityTokenPurpose::PasswordReset, (string) $validated['token']);

        $user->forceFill([
            'password' => Hash::make((string) $validated['password']),
        ])->save();

        $revokedAt = CarbonImmutable::now();
        RefreshToken::query()
            ->where('user_id', $user->getKey())
            ->whereNull('revoked_at')
            ->update([
                'revoked_at' => $revokedAt,
                'last_used_at' => $revokedAt,
                'updated_at' => $revokedAt,
            ]);

        $audit->record('auth.password_reset_confirmed', $user, $user, $request, $user);

        return response()->json([
            'message' => 'Senha redefinida com sucesso. Entre novamente com a nova senha.',
        ]);
    }

    public function refresh(
        RefreshTokenRequest $request,
        TokenPairService $tokenPairService,
        JwtService $jwtService,
    ): JsonResponse {
        $rawRefreshToken = $request->string('refresh_token')->toString();

        try {
            $decodedToken = $jwtService->decodeRefreshToken($rawRefreshToken);
            $tokenPair = $tokenPairService->refresh($rawRefreshToken, $request);
        } catch (InvalidTokenException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 401);
        }

        /** @var User $user */
        $user = User::query()->findOrFail($decodedToken->subject);

        return $this->tokenResponse($user, $tokenPair);
    }

    public function logout(
        RefreshTokenRequest $request,
        TokenPairService $tokenPairService,
    ): JsonResponse {
        $tokenPairService->revoke($request->string('refresh_token')->toString());

        return response()->json([
            'message' => 'Sessão encerrada com sucesso.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'user' => $user->loadMissing('boosterProfile'),
            ],
        ]);
    }

    private function tokenResponse(User $user, TokenPair $tokenPair): JsonResponse
    {
        return response()->json([
            'data' => [
                'user' => $user->loadMissing('boosterProfile'),
            ],
            'access_token' => $tokenPair->accessToken,
            'refresh_token' => $tokenPair->refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $tokenPair->accessExpiresIn,
            'refresh_expires_in' => $tokenPair->refreshExpiresIn,
        ]);
    }
}
