<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'booster_id',
    'service_order_id',
    'status',
    'riot_puuid',
    'game_name',
    'tag_line',
    'summoner_name',
    'region',
    'current_game_id',
    'current_queue_id',
    'current_champion_id',
    'ranked_snapshot',
    'lp_delta',
    'progress_percent',
    'started_at',
    'ended_at',
    'last_heartbeat_at',
])]
class BoosterTrackerSession extends Model
{
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_heartbeat_at' => 'datetime',
            'ranked_snapshot' => 'array',
            'progress_percent' => 'decimal:2',
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

    public function matches(): HasMany
    {
        return $this->hasMany(TrackedMatch::class, 'service_order_id', 'service_order_id')
            ->whereColumn('tracked_matches.booster_id', 'booster_tracker_sessions.booster_id');
    }
}
