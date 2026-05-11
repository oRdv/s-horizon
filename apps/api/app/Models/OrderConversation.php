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
    'status',
    'opened_at',
    'last_message',
    'last_message_at',
    'pinned_message_id',
])]
class OrderConversation extends Model
{
    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'last_message_at' => 'datetime',
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

    public function pinnedMessage(): BelongsTo
    {
        return $this->belongsTo(OrderChatMessage::class, 'pinned_message_id');
    }
}
