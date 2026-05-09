<?php

namespace App\Services\Payments;

use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

final class MercadoPagoPaymentProvider
{
    /**
     * @return array<string,mixed>
     */
    public function createPixPayment(Payment $payment): array
    {
        $accessToken = config('services.mercado_pago.access_token');

        if (! is_string($accessToken) || trim($accessToken) === '') {
            throw new PaymentConfigurationException('Mercado Pago nao configurado: defina MERCADO_PAGO_ACCESS_TOKEN no backend.');
        }

        $dateOfExpiration = Carbon::now('America/Sao_Paulo')
            ->addMinutes(10)
            ->setTimezone('UTC')
            ->format('Y-m-d\TH:i:s.000\Z');

        $transactionAmount = $this->providerAmount($payment->final_amount);
        if ($transactionAmount < 1) {
            Log::warning('payments.pix_amount_too_low', [
                'payment_id' => $payment->getKey(),
                'final_amount_cents' => $payment->final_amount,
                'transaction_amount' => $transactionAmount,
            ]);

            $transactionAmount = 1;
        }

        $payload = [
            'transaction_amount' => $transactionAmount,
            'description' => $payment->serviceOrder?->title ?? 'Horizon Boost',
            'payment_method_id' => 'pix',
            'external_reference' => (string) $payment->getKey(),
            'date_of_expiration' => $dateOfExpiration,
            'notification_url' => rtrim((string) config('payments.backend_url'), '/').'/api/payments/mercado-pago/webhook',
            'payer' => [
                'email' => $payment->customer_email,
            ],
            'metadata' => [
                'payment_id' => (string) $payment->getKey(),
                'order_id' => (string) $payment->order_id,
                'boost_id' => (string) $payment->boost_id,
            ],
        ];

        Log::debug('payments.mercado_pago_request', [
            'payment_id' => $payment->getKey(),
            'date_of_expiration' => $dateOfExpiration,
            'payload' => $payload,
        ]);

        $response = Http::withOptions([
            'verify' => $this->caBundle(),
            'timeout' => 30,
            'connect_timeout' => 20,
        ])
            ->withToken($accessToken)
            ->withHeaders(['X-Idempotency-Key' => 'payment-'.$payment->getKey()])
            ->post('https://api.mercadopago.com/v1/payments', $payload);

        if (! $response->successful()) {
            Log::error('payments.mercado_pago_failed', [
                'payment_id' => $payment->getKey(),
                'payload' => $payload,
                'status' => $response->status(),
                'response' => $response->body(),
            ]);

            throw new RuntimeException($response->json('message') ?? data_get($response->json(), 'cause.0.description') ?? 'Mercado Pago recusou a criacao do Pix.');
        }

        $data = $response->json();
        $transactionData = data_get($data, 'point_of_interaction.transaction_data', []);

        return [
            'provider_payment_id' => isset($data['id']) ? (string) $data['id'] : null,
            'qr_code' => $transactionData['qr_code'] ?? null,
            'qr_code_base64' => $transactionData['qr_code_base64'] ?? null,
            'pix_copy_paste' => $transactionData['qr_code'] ?? null,
            'expires_at' => $data['date_of_expiration'] ?? $dateOfExpiration,
            'raw' => $data,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function retrievePayment(string $providerPaymentId): array
    {
        $accessToken = config('services.mercado_pago.access_token');

        if (! is_string($accessToken) || trim($accessToken) === '') {
            throw new PaymentConfigurationException('Mercado Pago nao configurado: defina MERCADO_PAGO_ACCESS_TOKEN no backend.');
        }

        $response = Http::withOptions([
            'verify' => $this->caBundle(),
            'timeout' => 30,
            'connect_timeout' => 20,
        ])
            ->withToken($accessToken)
            ->get('https://api.mercadopago.com/v1/payments/'.$providerPaymentId);

        if (! $response->successful()) {
            throw new RuntimeException($response->json('message') ?? 'Nao foi possivel consultar o pagamento no Mercado Pago.');
        }

        return $response->json();
    }

    private function providerAmount(int $cents): int|float
    {
        if ($cents % 100 === 0) {
            return intdiv($cents, 100);
        }

        return round($cents / 100, 2);
    }

    private function caBundle(): bool|string
    {
        if (app()->environment('production')) {
            $caBundle = config('services.mercado_pago.ca_bundle');

            if (is_string($caBundle) && trim($caBundle) !== '') {
                return $caBundle;
            }

            return true;
        }

        return false;
    }
}
