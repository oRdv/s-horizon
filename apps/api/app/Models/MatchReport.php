<?php

namespace App\Models;

use App\Enums\MatchResult;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'external_match_id',
    'result',
    'duration_seconds',
    'played_at',
    'source',
    'payload',
])]
class MatchReport extends Model
{
    protected function casts(): array
    {
        return [
            'result' => MatchResult::class,
            'duration_seconds' => 'integer',
            'played_at' => 'immutable_datetime',
            'payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
