<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Models\Payment;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Orders\OrderChatService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

final class PaymentService
{
    public function __construct(
        private readonly PaymentPricingService $pricing,
        private readonly StripePaymentProvider $stripe,
        private readonly MercadoPagoPaymentProvider $mercadoPago,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function availableMethods(ServiceOrder $boost): array
    {
        return $this->pricing->methodsForBaseAmount($this->orderBaseAmount($boost));
    }

    /**
     * @return array{payment:Payment,gateway:array<string,mixed>}
     */
    public function create(User $user, ServiceOrder $boost, ServiceOrder $order, PaymentMethod $method, ?int $installments): array
    {
        if ((int) $order->customer_id !== (int) $user->getKey()) {
            throw new InvalidArgumentException('Pedido nao pertence ao usuario autenticado.');
        }

        if ((int) $boost->customer_id !== (int) $user->getKey()) {
            throw new InvalidArgumentException('Boost nao pertence ao usuario autenticado.');
        }

        if ($method === PaymentMethod::CreditCard) {
            $installments = $installments ?? 1;
            $maxInstallments = max(1, min(2, (int) config('payments.max_credit_installments', 2)));

            if ($installments < 1 || $installments > $maxInstallments) {
                throw new InvalidArgumentException('Parcelamento invalido. O maximo para credito e '.$maxInstallments.'x.');
            }
        } else {
            $installments = 1;
        }

        $provider = match ($method) {
            PaymentMethod::Pix => PaymentProvider::MercadoPago,
            PaymentMethod::CreditCard, PaymentMethod::DebitCard => PaymentProvider::Stripe,
        };

        $amounts = $this->pricing->calculateForMethod($this->orderBaseAmount($boost), $method);

        $payment = DB::transaction(function () use ($user, $order, $boost, $method, $provider, $amounts, $installments): Payment {
            $this->expireStalePixPayments($user, $order, $boost, $method, $installments);

            $reusablePayment = Payment::query()
                ->where('user_id', $user->getKey())
                ->where('order_id', $order->getKey())
                ->where('boost_id', $boost->getKey())
                ->where('method', $method->value)
                ->where('installments', $installments)
                ->when($method === PaymentMethod::Pix, function ($query): void {
                    $query->where(function ($pixQuery): void {
                        $pixQuery
                            ->whereNull('expires_at')
                            ->orWhere('expires_at', '>', now());
                    });
                })
                ->whereIn('status', [
                    PaymentStatus::WaitingPayment->value,
                    PaymentStatus::RequiresAction->value,
                    PaymentStatus::Processing->value,
                ])
                ->latest()
                ->lockForUpdate()
                ->first();

            if ($reusablePayment && $this->hasProviderPayload($reusablePayment)) {
                return $reusablePayment;
            }

            $payment = Payment::query()->create([
                'user_id' => $user->getKey(),
                'order_id' => $order->getKey(),
                'boost_id' => $boost->getKey(),
                'provider' => $provider->value,
                'method' => $method->value,
                'status' => PaymentStatus::WaitingPayment->value,
                'amount' => $amounts['finalAmount'],
                'base_amount' => $amounts['baseAmount'],
                'fee_amount' => $amounts['feeAmount'],
                'discount_amount' => $amounts['discountAmount'],
                'final_amount' => $amounts['finalAmount'],
                'currency' => 'BRL',
                'installments' => $installments,
                'customer_email' => $user->email,
                'metadata' => [
                    'pricing' => $amounts,
                    'payment_test_mode' => false,
                ],
            ]);

            $order->forceFill([
                'status' => ServiceOrderStatus::WaitingPayment->value,
                'base_price' => $amounts['baseAmount'],
                'final_price' => $amounts['finalAmount'],
                'payment_method' => $method->value,
                'payment_status' => PaymentStatus::WaitingPayment->value,
            ])->save();

            return $payment;
        });

        if (! $this->hasProviderPayload($payment)) {
            $gateway = match ($provider) {
                PaymentProvider::Stripe => $this->createStripePaymentIntent($payment),
                PaymentProvider::MercadoPago => $this->createMercadoPagoPix($payment),
            };

            return ['payment' => $payment->refresh(), 'gateway' => $gateway];
        }

        return ['payment' => $payment->refresh(), 'gateway' => $this->gatewayPayloadForExistingPayment($payment)];
    }

    public function markPaid(Payment $payment, array $providerData = []): Payment
    {
        if ($payment->status === PaymentStatus::Paid->value) {
            return $payment;
        }

        DB::transaction(function () use ($payment, $providerData): void {
            $payment->forceFill([
                'status' => PaymentStatus::Paid->value,
                'paid_at' => $payment->paid_at ?? $this->paidAtFromProvider($providerData) ?? now(),
                'metadata' => array_replace_recursive($payment->metadata ?? [], ['provider' => $providerData]),
            ])->save();

            $payment->serviceOrder?->forceFill([
                'status' => $payment->serviceOrder?->booster_id
                    ? ServiceOrderStatus::BoosterAssigned->value
                    : ServiceOrderStatus::WaitingBooster->value,
                'payment_status' => PaymentStatus::Paid->value,
                'final_price' => $payment->final_amount,
            ])->save();
        });

        if ($payment->serviceOrder?->booster_id) {
            app(OrderChatService::class)->ensureConversation($payment->serviceOrder->refresh());
        }

        return $payment->refresh();
    }

    public function markFailed(Payment $payment, PaymentStatus $status, array $providerData = []): Payment
    {
        if ($payment->status === PaymentStatus::Paid->value) {
            return $payment;
        }

        DB::transaction(function () use ($payment, $status, $providerData): void {
            $payment->forceFill([
                'status' => $status->value,
                'metadata' => array_replace_recursive($payment->metadata ?? [], ['provider' => $providerData]),
            ])->save();

            $payment->serviceOrder?->forceFill([
                'status' => match ($status) {
                    PaymentStatus::Expired => ServiceOrderStatus::Expired->value,
                    PaymentStatus::Refunded => ServiceOrderStatus::Refunded->value,
                    PaymentStatus::Cancelled => ServiceOrderStatus::Cancelled->value,
                    default => ServiceOrderStatus::Failed->value,
                },
                'payment_status' => $status->value,
            ])->save();
        });

        return $payment->refresh();
    }

    public function markStatus(Payment $payment, PaymentStatus $status, array $providerData = []): Payment
    {
        if ($payment->status === PaymentStatus::Paid->value) {
            return $payment;
        }

        DB::transaction(function () use ($payment, $status, $providerData): void {
            $payment->forceFill([
                'status' => $status->value,
                'metadata' => array_replace_recursive($payment->metadata ?? [], ['provider' => $providerData]),
            ])->save();

            $payment->serviceOrder?->forceFill([
                'status' => ServiceOrderStatus::WaitingPayment->value,
                'payment_status' => $status->value,
            ])->save();
        });

        return $payment->refresh();
    }

    public function reconcileProviderStatus(Payment $payment): Payment
    {
        if ($payment->status === PaymentStatus::Paid->value) {
            return $payment;
        }

        if ($payment->provider === PaymentProvider::Stripe->value && $payment->payment_intent_id) {
            $intent = $this->stripe->retrievePaymentIntent($payment->payment_intent_id);

            return match ($intent['status'] ?? null) {
                'succeeded' => $this->markPaid($payment, $intent),
                'processing' => $this->markStatus($payment, PaymentStatus::Processing, $intent),
                'requires_action', 'requires_source_action' => $this->markStatus($payment, PaymentStatus::RequiresAction, $intent),
                'requires_payment_method', 'canceled' => $this->markFailed($payment, PaymentStatus::Failed, $intent),
                default => $payment->refresh(),
            };
        }

        if ($payment->provider === PaymentProvider::MercadoPago->value && $payment->provider_payment_id) {
            $providerPayment = $this->mercadoPago->retrievePayment($payment->provider_payment_id);

            return $this->applyMercadoPagoStatus($payment, $providerPayment);
        }

        return $payment->refresh();
    }

    public function applyMercadoPagoStatus(Payment $payment, array $providerPayment): Payment
    {
        $payment->forceFill([
            'provider_payment_id' => (string) ($providerPayment['id'] ?? $payment->provider_payment_id),
            'final_amount' => isset($providerPayment['transaction_amount'])
                ? $this->decimalAmountToCents((string) $providerPayment['transaction_amount'])
                : $payment->final_amount,
            'metadata' => array_replace_recursive($payment->metadata ?? [], ['mercado_pago_latest' => $providerPayment]),
        ])->save();

        return match ($providerPayment['status'] ?? null) {
            'approved', 'accredited' => $this->markPaid($payment, $providerPayment),
            'cancelled', 'rejected' => $this->markFailed($payment, PaymentStatus::Failed, $providerPayment),
            'refunded' => $this->markFailed($payment, PaymentStatus::Refunded, $providerPayment),
            'expired' => $this->markFailed($payment, PaymentStatus::Expired, $providerPayment),
            'in_process', 'in_mediation' => $this->markStatus($payment, PaymentStatus::Processing, $providerPayment),
            default => $payment->refresh(),
        };
    }

    /**
     * @return array<string,mixed>
     */
    private function createStripePaymentIntent(Payment $payment): array
    {
        $gateway = $this->stripe->createPaymentIntent($payment);

        $payment->forceFill([
            'provider_payment_id' => $gateway['payment_intent_id'] ?? null,
            'payment_intent_id' => $gateway['payment_intent_id'] ?? null,
            'client_secret_last4_hash' => $gateway['client_secret_last4_hash'] ?? null,
            'metadata' => array_replace_recursive($payment->metadata ?? [], ['stripe' => $gateway['raw'] ?? []]),
        ])->save();

        return [
            'paymentId' => $payment->getKey(),
            'method' => $payment->method,
            'provider' => $payment->provider,
            'status' => $payment->status,
            'clientSecret' => $gateway['client_secret'] ?? null,
            'publishableKey' => config('services.stripe.public'),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function createMercadoPagoPix(Payment $payment): array
    {
        $gateway = $this->mercadoPago->createPixPayment($payment);

        $payment->forceFill([
            'provider_payment_id' => $gateway['provider_payment_id'] ?? null,
            'qr_code' => $gateway['qr_code'] ?? null,
            'qr_code_base64' => $gateway['qr_code_base64'] ?? null,
            'pix_copy_paste' => $gateway['pix_copy_paste'] ?? null,
            'expires_at' => $gateway['expires_at'] ?? null,
            'metadata' => array_replace_recursive($payment->metadata ?? [], ['mercado_pago' => $gateway['raw'] ?? []]),
        ])->save();

        return [
            'paymentId' => $payment->getKey(),
            'method' => $payment->method,
            'provider' => $payment->provider,
            'qrCode' => $payment->qr_code,
            'qrCodeBase64' => $payment->qr_code_base64,
            'pixCopyPaste' => $payment->pix_copy_paste,
            'expiresAt' => $payment->expires_at?->toIso8601String(),
            'status' => $payment->status,
        ];
    }

    private function orderBaseAmount(ServiceOrder $order): int
    {
        if ($order->base_price !== null) {
            return (int) $order->base_price;
        }

        return (int) round(((float) $order->price) * 100);
    }

    private function decimalAmountToCents(string $amount): int
    {
        $normalized = str_replace(',', '.', trim($amount));
        [$whole, $fraction] = array_pad(explode('.', $normalized, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }

    private function hasProviderPayload(Payment $payment): bool
    {
        if ($payment->provider === PaymentProvider::Stripe->value) {
            return filled($payment->payment_intent_id) && filled($payment->client_secret_last4_hash);
        }

        if ($payment->provider === PaymentProvider::MercadoPago->value) {
            return filled($payment->provider_payment_id) && filled($payment->pix_copy_paste);
        }

        return false;
    }

    private function expireStalePixPayments(
        User $user,
        ServiceOrder $order,
        ServiceOrder $boost,
        PaymentMethod $method,
        int $installments,
    ): void {
        if ($method !== PaymentMethod::Pix) {
            return;
        }

        Payment::query()
            ->where('user_id', $user->getKey())
            ->where('order_id', $order->getKey())
            ->where('boost_id', $boost->getKey())
            ->where('method', PaymentMethod::Pix->value)
            ->where('installments', $installments)
            ->where('status', PaymentStatus::WaitingPayment->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update([
                'status' => PaymentStatus::Expired->value,
                'updated_at' => now(),
            ]);
    }

    /**
     * @return array<string,mixed>
     */
    private function gatewayPayloadForExistingPayment(Payment $payment): array
    {
        if ($payment->provider === PaymentProvider::Stripe->value) {
            if (! $payment->payment_intent_id) {
                throw new RuntimeException('Pagamento de cartao sem PaymentIntent vinculado.');
            }

            $gateway = $this->stripe->retrievePaymentIntentForClient($payment->payment_intent_id);

            $payment->forceFill([
                'metadata' => array_replace_recursive($payment->metadata ?? [], ['stripe_reloaded' => $gateway['raw'] ?? []]),
            ])->save();

            return [
                'paymentId' => $payment->getKey(),
                'method' => $payment->method,
                'provider' => $payment->provider,
                'status' => $payment->status,
                'clientSecret' => $gateway['client_secret'] ?? null,
                'publishableKey' => config('services.stripe.public'),
            ];
        }

        return [
            'paymentId' => $payment->getKey(),
            'method' => $payment->method,
            'provider' => $payment->provider,
            'qrCode' => $payment->qr_code,
            'qrCodeBase64' => $payment->qr_code_base64,
            'pixCopyPaste' => $payment->pix_copy_paste,
            'expiresAt' => $payment->expires_at?->toIso8601String(),
            'status' => $payment->status,
        ];
    }

    private function paidAtFromProvider(array $providerData): ?\Carbon\CarbonImmutable
    {
        $date = data_get($providerData, 'charges.data.0.created')
            ?? data_get($providerData, 'date_approved')
            ?? data_get($providerData, 'money_release_date');

        if (is_numeric($date)) {
            return \Carbon\CarbonImmutable::createFromTimestamp((int) $date);
        }

        if (is_string($date) && $date !== '') {
            return \Carbon\CarbonImmutable::parse($date);
        }

        return null;
    }
}
