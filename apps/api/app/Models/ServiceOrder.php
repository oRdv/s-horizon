<?php

namespace App\Models;

use App\Enums\ServiceOrderStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'customer_id',
    'booster_id',
    'created_by',
    'service_type',
    'title',
    'description',
    'status',
    'price',
    'currency',
    'metadata',
    'purchased_at',
    'started_at',
    'completed_at',
])]
class ServiceOrder extends Model
{
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'metadata' => 'array',
            'purchased_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        self::creating(function (ServiceOrder $order): void {
            $order->status ??= ServiceOrderStatus::Pending->value;
            $order->currency ??= 'BRL';
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function booster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booster_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }
}
