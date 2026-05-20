<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Repositories\OrderRepository;
use App\Repositories\PaymentRepository;
use App\Services\Payments\MercadoPagoPaymentProvider;
use App\Services\Payments\PaymentConfigurationException;
use App\Services\Payments\PaymentService;
use App\Services\Payments\StripePaymentProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Throwable;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Payment::query()->with('serviceOrder');

        if (! $user->hasPermission('finance.control.view')) {
            $query->where('user_id', $user->getKey());
        }

        return response()->json([
            'data' => [
                'transactions' => $query->latest()->paginate(20),
            ],
        ]);
    }

    public function methods(
        Request $request,
        int $boostId,
        OrderRepository $orders,
        PaymentService $payments,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $boost = $orders->findBoostForUser($boostId, (int) $user->getKey());

        if (! $boost) {
            return $this->error('Boost não encontrado para o usuário autenticado.', 404);
        }

        return response()->json([
            'data' => $payments->availableMethods($boost),
        ]);
    }

    public function create(
        Request $request,
        OrderRepository $orders,
        PaymentService $payments,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== UserRole::Customer->value) {
            return $this->error('Apenas clientes podem finalizar pedidos e criar pagamentos.', 403, 'PAYMENT_FORBIDDEN');
        }

        $validated = $request->validate([
            'boostId' => ['required', 'integer'],
            'orderId' => ['required', 'integer'],
            'method' => ['required', Rule::in(array_column(PaymentMethod::cases(), 'value'))],
            'installments' => ['nullable', 'integer', 'min:1', 'max:2'],
        ]);

        $boost = $orders->findBoostForUser((int) $validated['boostId'], (int) $user->getKey());
        $order = $orders->findOwnedOrder((int) $validated['orderId'], (int) $user->getKey());

        if (! $boost || ! $order) {
            return $this->error('Boost ou pedido não encontrado para o usuário autenticado.', 404);
        }

        try {
            $result = $payments->create(
                $user,
                $boost,
                $order,
                PaymentMethod::from($validated['method']),
                isset($validated['installments']) ? (int) $validated['installments'] : null,
            );
        } catch (PaymentConfigurationException $exception) {
            return $this->error($exception->getMessage(), 503, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
        } catch (InvalidArgumentException $exception) {
            return $this->error($exception->getMessage(), 422);
        } catch (Throwable $exception) {
            Log::error('payments.create_failed', ['message' => $exception->getMessage()]);

            $message = 'Não foi possível criar o pagamento real no provedor.';
            if (config('app.debug')) {
                $message .= ' '.$exception->getMessage();
            }

            return $this->error($message, 502);
        }

        return response()->json([
            'data' => [
                'payment' => $this->serializePayment($result['payment']),
                ...$result['gateway'],
            ],
        ], 201);
    }

    public function status(Request $request, int $paymentId, PaymentRepository $payments, PaymentService $paymentService): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $payment = $payments->findForUser($paymentId, (int) $user->getKey());

        if (! $payment) {
            return $this->error('Pagamento não encontrado para o usuário autenticado.', 404);
        }

        if (in_array($payment->status, [
            PaymentStatus::WaitingPayment->value,
            PaymentStatus::RequiresAction->value,
            PaymentStatus::Processing->value,
        ], true)) {
            try {
                $payment = $paymentService->reconcileProviderStatus($payment);
            } catch (Throwable $exception) {
                Log::warning('payments.status_reconcile_failed', [
                    'payment_id' => $payment->getKey(),
                    'provider' => $payment->provider,
                    'message' => $exception->getMessage(),
                ]);

                if (
                    $payment->method === PaymentMethod::Pix->value
                    && $payment->status === PaymentStatus::WaitingPayment->value
                    && $payment->expires_at
                    && $payment->expires_at->isPast()
                ) {
                    $payment = $paymentService->markFailed($payment, PaymentStatus::Expired);
                }
            }
        }

        return response()->json([
            'data' => $this->serializePayment($payment->refresh()),
        ]);
    }

    public function stripeWebhook(
        Request $request,
        PaymentRepository $payments,
        PaymentService $paymentService,
        StripePaymentProvider $stripe,
    ): JsonResponse {
        $payload = $request->getContent();

        if (! $this->isValidStripeSignature($payload, (string) $request->header('Stripe-Signature'))) {
            return $this->error('Assinatura Stripe invalida.', 400);
        }

        $event = json_decode($payload, true);
        if (! is_array($event)) {
            return $this->error('Payload Stripe invalido.', 400);
        }

        $type = $event['type'] ?? null;
        $object = data_get($event, 'data.object', []);
        $paymentIntentId = ($object['object'] ?? null) === 'payment_intent'
            ? ($object['id'] ?? null)
            : ($object['payment_intent'] ?? null);

        $payment = $payments->findByStripePaymentIntent($paymentIntentId);

        $metadataPaymentId = data_get($object, 'metadata.paymentId') ?? data_get($object, 'metadata.payment_id');
        if (! $payment && is_numeric($metadataPaymentId)) {
            $payment = Payment::query()->find((int) $metadataPaymentId);
        }

        if (! $payment) {
            return response()->json(['received' => true]);
        }

        if ($paymentIntentId && ! $payment->provider_payment_id) {
            $payment->forceFill([
                'provider_payment_id' => $paymentIntentId,
                'payment_intent_id' => $paymentIntentId,
            ])->save();
        }

        $providerData = $paymentIntentId ? $stripe->retrievePaymentIntent($paymentIntentId) : $object;

        match ($type) {
            'payment_intent.succeeded' => $paymentService->markPaid($payment, $providerData),
            'payment_intent.payment_failed' => $paymentService->markFailed($payment, PaymentStatus::Failed, $providerData),
            'payment_intent.processing' => $paymentService->markStatus($payment, PaymentStatus::Processing, $providerData),
            'payment_intent.requires_action' => $paymentService->markStatus($payment, PaymentStatus::RequiresAction, $providerData),
            'charge.refunded' => $paymentService->markFailed($payment, PaymentStatus::Refunded, $object),
            default => null,
        };

        return response()->json(['received' => true]);
    }

    public function mercadoPagoWebhook(
        Request $request,
        PaymentRepository $payments,
        PaymentService $paymentService,
        MercadoPagoPaymentProvider $mercadoPago,
    ): JsonResponse {
        if (! $this->isValidMercadoPagoSignature($request)) {
            return $this->error('Assinatura Mercado Pago invalida.', 400);
        }

        $providerPaymentId = (string) ($request->input('data.id') ?? $request->input('id') ?? $request->query('data_id') ?? '');

        if ($providerPaymentId === '') {
            return response()->json(['received' => true]);
        }

        try {
            $providerPayment = $mercadoPago->retrievePayment($providerPaymentId);
        } catch (Throwable $exception) {
            Log::error('payments.mercado_pago_fetch_failed', ['message' => $exception->getMessage()]);

            return $this->error('Não foi possível consultar o pagamento no Mercado Pago.', 502);
        }

        $payment = $payments->findByProviderPaymentId($providerPaymentId);

        if (! $payment && is_numeric($providerPayment['external_reference'] ?? null)) {
            $payment = Payment::query()->find((int) $providerPayment['external_reference']);
        }

        if (! $payment) {
            return response()->json(['received' => true]);
        }

        $paymentService->applyMercadoPagoStatus($payment, $providerPayment);

        return response()->json(['received' => true]);
    }

    public function createCustomerPayment(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== UserRole::Customer->value) {
            return $this->error('Apenas clientes podem finalizar pedidos e criar pagamentos.', 403, 'PAYMENT_FORBIDDEN');
        }

        $validated = $request->validate([
            'service_type' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'amount' => ['required', 'integer', 'min:1'],
            'metadata' => ['nullable', 'array'],
        ]);

        $order = ServiceOrder::query()->create([
            'customer_id' => $user->getKey(),
            'created_by' => $user->getKey(),
            'service_type' => $validated['service_type'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'status' => ServiceOrderStatus::Pending->value,
            'price' => $validated['amount'] / 100,
            'base_price' => $validated['amount'],
            'final_price' => $validated['amount'],
            'currency' => 'BRL',
            'metadata' => $validated['metadata'] ?? [],
            'purchased_at' => now(),
        ]);

        return response()->json([
            'message' => 'Pedido registrado.',
            'data' => [
                'order' => $order->refresh(),
            ],
        ], 201);
    }

    private function isValidStripeSignature(string $payload, string $signature): bool
    {
        $secret = config('services.stripe.webhook_secret');
        if (! is_string($secret) || trim($secret) === '') {
            return false;
        }

        preg_match('/t=(\d+)/', $signature, $timestampMatch);
        preg_match('/v1=([a-f0-9]+)/', $signature, $signatureMatch);

        if (! isset($timestampMatch[1], $signatureMatch[1]) || abs(time() - (int) $timestampMatch[1]) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestampMatch[1].'.'.$payload, $secret);

        return hash_equals($expected, $signatureMatch[1]);
    }

    private function isValidMercadoPagoSignature(Request $request): bool
    {
        $secret = config('services.mercado_pago.webhook_secret');
        if (! is_string($secret) || trim($secret) === '') {
            Log::warning('payments.mercado_pago_webhook_secret_missing', [
                'environment' => app()->environment(),
            ]);

            return ! app()->environment('production');
        }

        $signature = (string) $request->header('x-signature');
        $requestId = (string) $request->header('x-request-id');
        $dataId = (string) ($request->input('data.id') ?? $request->query('data.id') ?? $request->query('id') ?? '');

        preg_match('/ts=([^,]+)/', $signature, $timestampMatch);
        preg_match('/v1=([^,]+)/', $signature, $hashMatch);

        if (! isset($timestampMatch[1], $hashMatch[1]) || $requestId === '' || $dataId === '') {
            return false;
        }

        $manifest = 'id:'.$dataId.';request-id:'.$requestId.';ts:'.$timestampMatch[1].';';
        $expected = hash_hmac('sha256', $manifest, $secret);

        return hash_equals($expected, $hashMatch[1]);
    }

    /**
     * @return array<string,mixed>
     */
    private function serializePayment(Payment $payment): array
    {
        return [
            'id' => $payment->getKey(),
            'paymentId' => $payment->getKey(),
            'userId' => $payment->user_id,
            'orderId' => $payment->order_id,
            'boostId' => $payment->boost_id,
            'provider' => $payment->provider,
            'method' => $payment->method,
            'status' => $payment->status,
            'amount' => $payment->amount,
            'baseAmount' => $payment->base_amount,
            'feeAmount' => $payment->fee_amount,
            'discountAmount' => $payment->discount_amount,
            'finalAmount' => $payment->final_amount,
            'currency' => $payment->currency,
            'installments' => $payment->installments,
            'providerPaymentId' => $payment->provider_payment_id,
            'providerPreferenceId' => $payment->provider_preference_id,
            'providerSessionId' => $payment->provider_session_id,
            'paymentIntentId' => $payment->payment_intent_id,
            'qrCode' => $payment->qr_code,
            'qrCodeBase64' => $payment->qr_code_base64,
            'pixCopyPaste' => $payment->pix_copy_paste,
            'customerEmail' => $payment->customer_email,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'expiresAt' => $payment->expires_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
            'updatedAt' => $payment->updated_at?->toIso8601String(),
            'service_order' => $payment->serviceOrder,
        ];
    }

    private function error(string $message, int $status, string $code = 'PAYMENT_ERROR'): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ], $status);
    }
}
