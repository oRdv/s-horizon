<?php

namespace App\Services\Auth;

use App\Exceptions\InvalidTokenException;
use App\Models\User;
use App\Support\Auth\DecodedJwt;
use Carbon\CarbonImmutable;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class JwtService
{
    public function issueAccessToken(
        User $user,
        CarbonImmutable $issuedAt,
        CarbonImmutable $expiresAt,
    ): string {
        return $this->encode($this->basePayload($user, 'access', $issuedAt, $expiresAt));
    }

    public function issueRefreshToken(
        User $user,
        string $jti,
        CarbonImmutable $issuedAt,
        CarbonImmutable $expiresAt,
    ): string {
        return $this->encode($this->basePayload($user, 'refresh', $issuedAt, $expiresAt, $jti));
    }

    public function decodeAccessToken(string $token): DecodedJwt
    {
        $decoded = $this->decode($token);

        if (! $decoded->isAccessToken()) {
            throw new InvalidTokenException('O token informado não é um access token.');
        }

        return $decoded;
    }

    public function decodeRefreshToken(string $token): DecodedJwt
    {
        $decoded = $this->decode($token);

        if (! $decoded->isRefreshToken()) {
            throw new InvalidTokenException('O token informado não é um refresh token.');
        }

        return $decoded;
    }

    private function basePayload(
        User $user,
        string $type,
        CarbonImmutable $issuedAt,
        CarbonImmutable $expiresAt,
        ?string $jti = null,
    ): array {
        return [
            'iss' => config('jwt.issuer'),
            'sub' => (string) $user->getKey(),
            'jti' => $jti ?? (string) Str::uuid(),
            'type' => $type,
            'iat' => $issuedAt->timestamp,
            'nbf' => $issuedAt->timestamp,
            'exp' => $expiresAt->timestamp,
        ];
    }

    private function encode(array $payload): string
    {
        return JWT::encode($payload, $this->secret(), 'HS256');
    }

    private function decode(string $token): DecodedJwt
    {
        try {
            $payload = JWT::decode($token, new Key($this->secret(), 'HS256'));
        } catch (ExpiredException) {
            throw new InvalidTokenException('O token expirou.');
        } catch (Throwable) {
            throw new InvalidTokenException('O token informado é inválido.');
        }

        $issuer = property_exists($payload, 'iss') ? (string) $payload->iss : null;

        if ($issuer !== config('jwt.issuer')) {
            throw new InvalidTokenException('O emissor do token é inválido.');
        }

        $subject = property_exists($payload, 'sub') ? (int) $payload->sub : 0;
        $jti = property_exists($payload, 'jti') ? (string) $payload->jti : '';
        $type = property_exists($payload, 'type') ? (string) $payload->type : '';
        $issuedAt = property_exists($payload, 'iat') ? (int) $payload->iat : 0;
        $expiresAt = property_exists($payload, 'exp') ? (int) $payload->exp : 0;

        if ($subject <= 0 || $jti === '' || $type === '' || $issuedAt <= 0 || $expiresAt <= 0) {
            throw new InvalidTokenException('O payload do token está incompleto.');
        }

        return new DecodedJwt(
            subject: $subject,
            jti: $jti,
            type: $type,
            issuedAt: CarbonImmutable::createFromTimestampUTC($issuedAt),
            expiresAt: CarbonImmutable::createFromTimestampUTC($expiresAt),
        );
    }

    private function secret(): string
    {
        $secret = (string) config('jwt.secret');

        if ($secret === '') {
            throw new RuntimeException('JWT_SECRET não está configurado.');
        }

        return $secret;
    }
}
