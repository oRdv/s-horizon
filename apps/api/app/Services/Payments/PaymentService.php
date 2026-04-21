<?php

namespace App\Services\Payments;

use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Models\PaymentTransaction;

final class PaymentService
{
    /**
     * @return array<string, mixed>
     */
    public function prepareGatewayPayload(PaymentTransaction $transaction): array
    {
        $gateway = match ($transaction->provider) {
            PaymentProvider::Stripe->value => new StripePaymentGateway(),
            PaymentProvider::MercadoPago->value => new MercadoPagoPaymentGateway(),
            default => null,
        };

        if (! $gateway) {
            return [
                'provider' => PaymentProvider::Manual->value,
                'provider_reference' => null,
                'checkout_url' => null,
                'message' => 'Pagamento manual registrado.',
            ];
        }

        $payload = $gateway->createPayment($transaction);

        $transaction->forceFill([
            'provider_reference' => $payload['provider_reference'] ?? null,
            'status' => PaymentStatus::Pending->value,
            'metadata' => [
                ...($transaction->metadata ?? []),
                'gateway_payload' => $payload,
            ],
        ])->save();

        return $payload;
    }
}
