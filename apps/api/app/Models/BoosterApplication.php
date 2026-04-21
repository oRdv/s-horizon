<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'reviewed_by',
    'status',
    'full_name',
    'birth_date',
    'age',
    'cpf',
    'pix_key',
    'gender',
    'in_game_nick',
    'highest_rank',
    'previous_season_rank',
    'available_hours',
    'location',
    'accepts_riot_responsibility',
    'accepts_confidentiality_terms',
    'initial_percentage',
    'accepts_initial_percentage',
    'opgg_url',
    'discord_username',
    'diamond_plus_eta',
    'accepts_cashflow_decay',
    'review_notes',
    'submitted_at',
    'reviewed_at',
])]
class BoosterApplication extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'birth_date' => 'date:Y-m-d',
            'age' => 'integer',
            'accepts_riot_responsibility' => 'boolean',
            'accepts_confidentiality_terms' => 'boolean',
            'initial_percentage' => 'decimal:2',
            'accepts_initial_percentage' => 'boolean',
            'accepts_cashflow_decay' => 'boolean',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
