<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use InvalidArgumentException;

final class PaymentPricingService
{
    /**
     * @return array{basePrice:int,currency:string,methods:array<int,array<string,mixed>>}
     */
    public function methodsForBaseAmount(int $baseAmount): array
    {
        if ($baseAmount <= 0) {
            throw new InvalidArgumentException('O valor base do boost precisa ser maior que zero.');
        }

        $credit = $this->calculateForMethod($baseAmount, PaymentMethod::CreditCard);
        $debit = $this->calculateForMethod($baseAmount, PaymentMethod::DebitCard);

        return [
            'basePrice' => $baseAmount,
            'currency' => 'BRL',
            'methods' => [
                [
                    'method' => PaymentMethod::Pix->value,
                    'provider' => PaymentProvider::MercadoPago->value,
                    'label' => 'PIX',
                    'description' => null,
                    'finalAmount' => $baseAmount,
                    'installments' => [],
                    'available' => $this->isMercadoPagoConfigured(),
                    'unavailableReason' => $this->isMercadoPagoConfigured() ? null : 'Mercado Pago nao configurado no backend.',
                ],
                [
                    'method' => PaymentMethod::CreditCard->value,
                    'provider' => PaymentProvider::Stripe->value,
                    'label' => 'Cartao de credito',
                    'description' => null,
                    'finalAmount' => $credit['finalAmount'],
                    'installments' => $this->installments($credit['finalAmount']),
                    'available' => $this->isStripeConfigured(),
                    'unavailableReason' => $this->isStripeConfigured() ? null : 'Stripe nao configurado no backend.',
                ],
                [
                    'method' => PaymentMethod::DebitCard->value,
                    'provider' => PaymentProvider::Stripe->value,
                    'label' => 'Cartao de debito',
                    'description' => null,
                    'finalAmount' => $debit['finalAmount'],
                    'installments' => [],
                    'available' => $this->isStripeConfigured(),
                    'unavailableReason' => $this->isStripeConfigured() ? null : 'Stripe nao configurado no backend.',
                ],
            ],
        ];
    }

    /**
     * @return array{baseAmount:int,feeAmount:int,discountAmount:int,finalAmount:int}
     */
    public function calculateForMethod(int $baseAmount, PaymentMethod $method): array
    {
        $feePercent = match ($method) {
            PaymentMethod::Pix => 0,
            PaymentMethod::CreditCard => $this->configuredPercent('payments.card_credit_fee_percent'),
            PaymentMethod::DebitCard => $this->configuredPercent('payments.card_debit_fee_percent'),
        };

        $feeAmount = $this->percentOf($baseAmount, $feePercent);

        return [
            'baseAmount' => $baseAmount,
            'feeAmount' => $feeAmount,
            'discountAmount' => 0,
            'finalAmount' => $baseAmount + $feeAmount,
        ];
    }

    /**
     * @return array<int,array{quantity:int,amount:int,total:int}>
     */
    public function installments(int $totalAmount): array
    {
        $max = max(1, min(2, (int) config('payments.max_credit_installments', 2)));
        $installments = [];

        for ($quantity = 1; $quantity <= $max; $quantity++) {
            $installments[] = [
                'quantity' => $quantity,
                'amount' => intdiv($totalAmount + $quantity - 1, $quantity),
                'total' => $totalAmount,
            ];
        }

        return $installments;
    }

    public function configuredPercent(string $key): int
    {
        $value = (string) config($key, '0');
        $normalized = str_replace(',', '.', trim($value));

        if ($normalized === '' || ! preg_match('/^\d+(\.\d{1,4})?$/', $normalized)) {
            return 0;
        }

        [$whole, $fraction] = array_pad(explode('.', $normalized, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    private function percentOf(int $amount, int $basisPoints): int
    {
        if ($basisPoints <= 0) {
            return 0;
        }

        return intdiv(($amount * $basisPoints) + 9999, 10000);
    }

    private function isStripeConfigured(): bool
    {
        return filled(config('services.stripe.secret')) && filled(config('services.stripe.public'));
    }

    private function isMercadoPagoConfigured(): bool
    {
        return filled(config('services.mercado_pago.access_token'));
    }
}
