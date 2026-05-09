<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'service_order_id',
    'customer_id',
    'booster_id',
    'opened_at',
])]
class OrderConversation extends Model
{
    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
        ];
    }

    public function serviceOrder(): BelongsTo
    {
        return $this->belongsTo(ServiceOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function booster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booster_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OrderChatMessage::class)->latest();
    }
}
