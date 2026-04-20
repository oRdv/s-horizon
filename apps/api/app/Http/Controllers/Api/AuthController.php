<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\InvalidTokenException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RefreshTokenRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Services\Auth\JwtService;
use App\Services\Auth\TokenPairService;
use App\Support\Auth\TokenPair;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => Hash::make($request->string('password')->toString()),
            'role' => 'customer',
        ]);

        return response()->json([
            'message' => 'Conta criada com sucesso.',
            'data' => [
                'user' => $user,
            ],
        ], 201);
    }

    public function login(LoginRequest $request, TokenPairService $tokenPairService): JsonResponse
    {
        /** @var User|null $user */
        $user = User::query()
            ->where('email', $request->string('email')->toString())
            ->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            return response()->json([
                'message' => 'As credenciais informadas são inválidas.',
            ], 401);
        }

        $tokenPair = $tokenPairService->issueForUser($user, $request);

        return $this->tokenResponse($user, $tokenPair);
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
        return response()->json([
            'data' => [
                'user' => $request->user(),
            ],
        ]);
    }

    private function tokenResponse(User $user, TokenPair $tokenPair): JsonResponse
    {
        return response()->json([
            'data' => [
                'user' => $user,
            ],
            'access_token' => $tokenPair->accessToken,
            'refresh_token' => $tokenPair->refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $tokenPair->accessExpiresIn,
            'refresh_expires_in' => $tokenPair->refreshExpiresIn,
        ]);
    }
}
