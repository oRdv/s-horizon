<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Models\PaymentTransaction;
use Illuminate\Support\Str;

final class StripePaymentGateway implements PaymentGateway
{
    public function createPayment(PaymentTransaction $transaction): array
    {
        if ($transaction->method === PaymentMethod::Pix->value) {
            $pixCode = $this->createMockPixCode($transaction);

            return [
                'provider' => 'stripe',
                'provider_reference' => 'stripe_pix_mock_'.$transaction->getKey(),
                'checkout_url' => null,
                'message' => 'Pix Stripe mockado gerado com QR Code e copia e cola.',
                'payment_data' => [
                    'type' => 'pix',
                    'mock' => true,
                    'amount' => (string) $transaction->amount,
                    'currency' => $transaction->currency,
                    'expires_at' => now()->addMinutes(30)->toIso8601String(),
                    'pix_copy_paste' => $pixCode,
                    'qr_code_payload' => $pixCode,
                    'merchant_name' => 'Horizon Boost',
                ],
            ];
        }

        return [
            'provider' => 'stripe',
            'provider_reference' => 'stripe_card_mock_'.$transaction->getKey(),
            'checkout_url' => 'https://checkout.stripe.mock/session/'.Str::lower((string) Str::uuid()),
            'message' => 'Checkout Stripe mockado preparado para cartao.',
            'payment_data' => [
                'type' => 'card',
                'mock' => true,
                'amount' => (string) $transaction->amount,
                'currency' => $transaction->currency,
            ],
        ];
    }

    private function createMockPixCode(PaymentTransaction $transaction): string
    {
        $amount = number_format((float) $transaction->amount, 2, '.', '');
        $reference = 'HB'.str_pad((string) $transaction->getKey(), 8, '0', STR_PAD_LEFT);

        return implode('', [
            '000201',
            '010212',
            '26580014BR.GOV.BCB.PIX',
            '0136horizonboost+'.$reference.'@pix.mock',
            '52040000',
            '5303986',
            '54'.str_pad((string) strlen($amount), 2, '0', STR_PAD_LEFT).$amount,
            '5802BR',
            '5913HORIZON BOOST',
            '6009SAO PAULO',
            '62070503***',
            '6304MOCK',
        ]);
    }
}
