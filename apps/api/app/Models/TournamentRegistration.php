<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'game',
    'category_id',
    'category_title',
    'status',
    'team_name',
    'team_tag',
    'captain_name',
    'captain_email',
    'captain_phone',
    'captain_discord',
    'server',
    'team_discord',
    'how_found',
    'roster',
    'notes',
    'accepted_rules',
    'accepted_check_in',
    'submitted_at',
])]
class TournamentRegistration extends Model
{
    protected function casts(): array
    {
        return [
            'roster' => 'array',
            'accepted_rules' => 'boolean',
            'accepted_check_in' => 'boolean',
            'submitted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
