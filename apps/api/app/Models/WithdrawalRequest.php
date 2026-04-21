<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'booster_id',
    'reviewed_by',
    'amount',
    'method',
    'pix_key',
    'status',
    'notes',
    'rejection_reason',
    'metadata',
    'requested_at',
    'reviewed_at',
])]
class WithdrawalRequest extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'metadata' => 'array',
            'requested_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function booster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booster_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
