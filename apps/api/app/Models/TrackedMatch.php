<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'service_order_id',
    'booster_id',
    'riot_puuid',
    'match_id',
    'game_id',
    'champion_id',
    'queue_id',
    'result',
    'kills',
    'deaths',
    'assists',
    'lp_before',
    'lp_after',
    'started_at',
    'ended_at',
    'duration_seconds',
    'raw_data',
])]
class TrackedMatch extends Model
{
    protected function casts(): array
    {
        return [
            'raw_data' => 'array',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function booster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booster_id');
    }

    public function serviceOrder(): BelongsTo
    {
        return $this->belongsTo(ServiceOrder::class, 'service_order_id');
    }
}
