<?php

namespace App\Support\Auth;

use Carbon\CarbonImmutable;

final readonly class TokenPair
{
    public function __construct(
        public string $accessToken,
        public string $refreshToken,
        public string $refreshTokenId,
        public int $accessExpiresIn,
        public int $refreshExpiresIn,
        public CarbonImmutable $accessExpiresAt,
        public CarbonImmutable $refreshExpiresAt,
    ) {
    }
}
