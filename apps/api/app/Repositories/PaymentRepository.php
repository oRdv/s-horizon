<?php

namespace App\Repositories;

use App\Models\Payment;

final class PaymentRepository
{
    public function findForUser(int $paymentId, int $userId): ?Payment
    {
        return Payment::query()
            ->with('serviceOrder')
            ->whereKey($paymentId)
            ->where('user_id', $userId)
            ->first();
    }

    public function findByStripePaymentIntent(?string $paymentIntentId): ?Payment
    {
        if (! $paymentIntentId) {
            return null;
        }

        return Payment::query()
            ->where(function ($query) use ($paymentIntentId): void {
                $query
                    ->where('payment_intent_id', $paymentIntentId)
                    ->orWhere('provider_payment_id', $paymentIntentId);
            })
            ->first();
    }

    public function findByProviderPaymentId(string $providerPaymentId): ?Payment
    {
        return Payment::query()->where('provider_payment_id', $providerPaymentId)->first();
    }
}
