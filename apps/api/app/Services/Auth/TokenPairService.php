<?php

namespace App\Services\Auth;

use App\Exceptions\InvalidTokenException;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\Auth\TokenPair;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TokenPairService
{
    public function __construct(
        private readonly JwtService $jwtService,
    ) {
    }

    public function issueForUser(User $user, ?Request $request = null): TokenPair
    {
        $issuedAt = CarbonImmutable::now();
        $accessExpiresAt = $issuedAt->addMinutes((int) config('jwt.access_ttl'));
        $refreshExpiresAt = $issuedAt->addMinutes((int) config('jwt.refresh_ttl'));
        $refreshTokenId = (string) Str::uuid();

        $accessToken = $this->jwtService->issueAccessToken($user, $issuedAt, $accessExpiresAt);
        $refreshToken = $this->jwtService->issueRefreshToken($user, $refreshTokenId, $issuedAt, $refreshExpiresAt);

        RefreshToken::query()->create([
            'user_id' => $user->getKey(),
            'jti' => $refreshTokenId,
            'expires_at' => $refreshExpiresAt,
            ...$this->requestMetadata($request),
        ]);

        return new TokenPair(
            accessToken: $accessToken,
            refreshToken: $refreshToken,
            refreshTokenId: $refreshTokenId,
            accessExpiresIn: $issuedAt->diffInSeconds($accessExpiresAt),
            refreshExpiresIn: $issuedAt->diffInSeconds($refreshExpiresAt),
            accessExpiresAt: $accessExpiresAt,
            refreshExpiresAt: $refreshExpiresAt,
        );
    }

    public function refresh(string $refreshToken, ?Request $request = null): TokenPair
    {
        $decoded = $this->jwtService->decodeRefreshToken($refreshToken);

        /** @var RefreshToken|null $storedToken */
        $storedToken = RefreshToken::query()
            ->with('user')
            ->where('jti', $decoded->jti)
            ->first();

        if (! $storedToken || ! $storedToken->user) {
            throw new InvalidTokenException('O refresh token não foi encontrado.');
        }

        if ((int) $storedToken->user_id !== $decoded->subject) {
            throw new InvalidTokenException('O refresh token não pertence ao usuário informado.');
        }

        if ($storedToken->isRevoked() || $storedToken->isExpired()) {
            throw new InvalidTokenException('O refresh token não pode mais ser utilizado.');
        }

        return DB::transaction(function () use ($request, $storedToken): TokenPair {
            $refreshedPair = $this->issueForUser($storedToken->user, $request);
            $usedAt = CarbonImmutable::now();

            $storedToken->forceFill([
                'last_used_at' => $usedAt,
                'revoked_at' => $usedAt,
                'replaced_by_jti' => $refreshedPair->refreshTokenId,
            ])->save();

            return $refreshedPair;
        });
    }

    public function revoke(?string $refreshToken): void
    {
        if (! is_string($refreshToken) || trim($refreshToken) === '') {
            return;
        }

        try {
            $decoded = $this->jwtService->decodeRefreshToken($refreshToken);
        } catch (InvalidTokenException) {
            return;
        }

        /** @var RefreshToken|null $storedToken */
        $storedToken = RefreshToken::query()
            ->where('jti', $decoded->jti)
            ->first();

        if (! $storedToken || $storedToken->isRevoked()) {
            return;
        }

        $revokedAt = CarbonImmutable::now();

        $storedToken->forceFill([
            'revoked_at' => $revokedAt,
            'last_used_at' => $revokedAt,
        ])->save();
    }

    private function requestMetadata(?Request $request): array
    {
        $userAgent = $request?->userAgent();

        return [
            'ip_address' => $request?->ip(),
            'user_agent' => is_string($userAgent) ? Str::limit($userAgent, 500, '') : null,
        ];
    }
}
