<?php

namespace App\Support\Auth;

use Carbon\CarbonImmutable;

final readonly class DecodedJwt
{
    public function __construct(
        public int $subject,
        public string $jti,
        public string $type,
        public CarbonImmutable $issuedAt,
        public CarbonImmutable $expiresAt,
    ) {
    }

    public function isAccessToken(): bool
    {
        return $this->type === 'access';
    }

    public function isRefreshToken(): bool
    {
        return $this->type === 'refresh';
    }
}
