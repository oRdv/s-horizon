<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'order_id',
    'boost_id',
    'provider',
    'method',
    'status',
    'amount',
    'base_amount',
    'fee_amount',
    'discount_amount',
    'final_amount',
    'currency',
    'installments',
    'provider_payment_id',
    'provider_preference_id',
    'provider_session_id',
    'payment_intent_id',
    'client_secret_last4_hash',
    'qr_code',
    'qr_code_base64',
    'pix_copy_paste',
    'customer_email',
    'metadata',
    'paid_at',
    'expires_at',
])]
class Payment extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'base_amount' => 'integer',
            'fee_amount' => 'integer',
            'discount_amount' => 'integer',
            'final_amount' => 'integer',
            'installments' => 'integer',
            'metadata' => 'array',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function serviceOrder(): BelongsTo
    {
        return $this->belongsTo(ServiceOrder::class, 'order_id');
    }
}
