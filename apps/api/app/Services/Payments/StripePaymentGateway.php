<?php

namespace App\Services\Payments;

use App\Models\PaymentTransaction;

final class StripePaymentGateway implements PaymentGateway
{
    public function createPayment(PaymentTransaction $transaction): array
    {
        return [
            'provider' => 'stripe',
            'provider_reference' => 'stripe_stub_'.$transaction->getKey(),
            'checkout_url' => null,
            'message' => 'Gateway Stripe preparado para integração real.',
        ];
    }
}
