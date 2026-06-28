<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class StripePaymentProvider
{
    /**
     * @return array<string,mixed>
     */
    public function createPaymentIntent(Payment $payment): array
    {
        $secret = $this->secretKey();
        $publishableKey = $this->publishableKey();
        $this->assertMatchingKeyMode($secret, $publishableKey);

        $method = PaymentMethod::from($payment->method);

        if (! in_array($method, [PaymentMethod::CreditCard, PaymentMethod::DebitCard], true)) {
            throw new RuntimeException('Stripe PaymentIntent so deve ser usado para cartao.');
        }

        $payload = [
            'amount' => $payment->final_amount,
            'currency' => strtolower($payment->currency),
            'receipt_email' => $payment->customer_email,
            'description' => $payment->serviceOrder?->title ?? 'Horizon Boost',
            'payment_method_types' => ['card'],
            'metadata' => [
                'paymentId' => (string) $payment->getKey(),
                'payment_id' => (string) $payment->getKey(),
                'orderId' => (string) $payment->order_id,
                'order_id' => (string) $payment->order_id,
                'boostId' => (string) $payment->boost_id,
                'boost_id' => (string) $payment->boost_id,
                'userId' => (string) $payment->user_id,
                'user_id' => (string) $payment->user_id,
                'method' => $payment->method,
                'installments' => (string) ($payment->installments ?? 1),
            ],
        ];

        $response = Http::asForm()
            ->withOptions(['verify' => $this->caBundle()])
            ->withToken($secret, 'Bearer')
            ->withHeaders($this->headers('payment-intent-'.$payment->getKey()))
            ->post('https://api.stripe.com/v1/payment_intents', $payload);

        if (! $response->successful()) {
            throw new RuntimeException($response->json('error.message') ?? 'Stripe recusou a criacao do PaymentIntent.');
        }

        $intent = $response->json();

        return [
            'payment_intent_id' => $intent['id'] ?? null,
            'client_secret' => $intent['client_secret'] ?? null,
            'client_secret_last4_hash' => isset($intent['client_secret'])
                ? hash('sha256', substr((string) $intent['client_secret'], -4))
                : null,
            'raw' => $this->redactClientSecret($intent),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function retrievePaymentIntent(string $paymentIntentId): array
    {
        $response = Http::withOptions(['verify' => $this->caBundle()])
            ->withToken($this->secretKey(), 'Bearer')
            ->withHeaders($this->headers())
            ->get('https://api.stripe.com/v1/payment_intents/'.$paymentIntentId);

        if (! $response->successful()) {
            throw new RuntimeException($response->json('error.message') ?? 'Nao foi possivel consultar o PaymentIntent na Stripe.');
        }

        return $this->redactClientSecret($response->json());
    }

    /**
     * @return array{client_secret:?string,raw:array<string,mixed>}
     */
    public function retrievePaymentIntentForClient(string $paymentIntentId): array
    {
        $response = Http::withOptions(['verify' => $this->caBundle()])
            ->withToken($this->secretKey(), 'Bearer')
            ->withHeaders($this->headers())
            ->get('https://api.stripe.com/v1/payment_intents/'.$paymentIntentId);

        if (! $response->successful()) {
            throw new RuntimeException($response->json('error.message') ?? 'Nao foi possivel consultar o PaymentIntent na Stripe.');
        }

        $intent = $response->json();

        return [
            'client_secret' => $intent['client_secret'] ?? null,
            'raw' => $this->redactClientSecret($intent),
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function redactClientSecret(array $payload): array
    {
        if (array_key_exists('client_secret', $payload)) {
            $payload['client_secret'] = '[redacted]';
        }

        return $payload;
    }

    private function secretKey(): string
    {
        $secret = config('services.stripe.secret');

        if (! is_string($secret) || trim($secret) === '') {
            throw new PaymentConfigurationException('Stripe nao configurado: defina STRIPE_SECRET_KEY no backend.');
        }

        $secret = trim($secret);

        if ($this->keyMode($secret, ['sk', 'rk']) === null) {
            throw new PaymentConfigurationException('Stripe nao configurado: STRIPE_SECRET_KEY deve iniciar com sk_live_, sk_test_, rk_live_ ou rk_test_.');
        }

        if ($this->requiresLiveKeys() && $this->keyMode($secret, ['sk', 'rk']) !== 'live') {
            throw new PaymentConfigurationException('Stripe em producao exige uma chave Live no backend.');
        }

        return $secret;
    }

    private function publishableKey(): string
    {
        $publishableKey = config('services.stripe.public');

        if (! is_string($publishableKey) || trim($publishableKey) === '') {
            throw new PaymentConfigurationException('Stripe nao configurado: defina STRIPE_PUBLIC_KEY no backend.');
        }

        $publishableKey = trim($publishableKey);

        if ($this->keyMode($publishableKey, ['pk']) === null) {
            throw new PaymentConfigurationException('Stripe nao configurado: STRIPE_PUBLIC_KEY deve iniciar com pk_live_ ou pk_test_.');
        }

        return $publishableKey;
    }

    private function assertMatchingKeyMode(string $secret, string $publishableKey): void
    {
        $secretMode = $this->keyMode($secret, ['sk', 'rk']);
        $publishableMode = $this->keyMode($publishableKey, ['pk']);

        if ($secretMode !== $publishableMode) {
            throw new PaymentConfigurationException('Stripe nao configurado: as chaves publica e secreta precisam ser do mesmo ambiente.');
        }

        if ($this->requiresLiveKeys() && $publishableMode !== 'live') {
            throw new PaymentConfigurationException('Stripe em producao exige chave publica Live.');
        }
    }

    /**
     * @param array<int,string> $prefixes
     */
    private function keyMode(string $key, array $prefixes): ?string
    {
        foreach ($prefixes as $prefix) {
            if (str_starts_with($key, $prefix.'_live_')) {
                return 'live';
            }

            if (str_starts_with($key, $prefix.'_test_')) {
                return 'test';
            }
        }

        return null;
    }

    private function requiresLiveKeys(): bool
    {
        if (app()->environment('testing')) {
            return false;
        }

        return filter_var(config('services.stripe.require_live'), FILTER_VALIDATE_BOOLEAN);
    }

    private function caBundle(): bool|string
    {
        $caBundle = config('services.stripe.ca_bundle');

        if (is_string($caBundle) && trim($caBundle) !== '') {
            return $caBundle;
        }

        return true;
    }

    /**
     * @return array<string,string>
     */
    private function headers(?string $idempotencyKey = null): array
    {
        $headers = [
            'Stripe-Version' => '2026-02-25.clover',
        ];

        if ($idempotencyKey) {
            $headers['Idempotency-Key'] = $idempotencyKey;
        }

        return $headers;
    }
}
