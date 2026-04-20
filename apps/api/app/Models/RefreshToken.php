<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'jti',
    'replaced_by_jti',
    'expires_at',
    'last_used_at',
    'revoked_at',
    'ip_address',
    'user_agent',
])]
class RefreshToken extends Model
{
    protected function casts(): array
    {
        return [
            'expires_at' => 'immutable_datetime',
            'last_used_at' => 'immutable_datetime',
            'revoked_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at?->isPast() ?? false;
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }
}
