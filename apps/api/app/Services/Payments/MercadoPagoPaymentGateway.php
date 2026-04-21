<?php

namespace App\Services\Payments;

use App\Models\PaymentTransaction;

final class MercadoPagoPaymentGateway implements PaymentGateway
{
    public function createPayment(PaymentTransaction $transaction): array
    {
        return [
            'provider' => 'mercado_pago',
            'provider_reference' => 'mp_stub_'.$transaction->getKey(),
            'checkout_url' => null,
            'message' => 'Gateway Mercado Pago preparado para integração real.',
        ];
    }
}
