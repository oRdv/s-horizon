<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\PaymentTransaction;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use App\Services\Payments\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = PaymentTransaction::query()->with('serviceOrder');

        if (! $user->hasPermission('finance.control.view')) {
            $query->where('user_id', $user->getKey());
        }

        return response()->json([
            'data' => [
                'transactions' => $query->latest()->paginate(20),
            ],
        ]);
    }

    public function createCustomerPayment(
        Request $request,
        PaymentService $payments,
        AccountAuditService $audit,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'service_type' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'amount' => ['required', 'numeric', 'min:1'],
            'provider' => ['required', Rule::in([PaymentProvider::Stripe->value, PaymentProvider::MercadoPago->value])],
            'method' => ['required', Rule::in([PaymentMethod::Pix->value, PaymentMethod::Card->value])],
            'metadata' => ['nullable', 'array'],
        ]);

        $order = ServiceOrder::query()->create([
            'customer_id' => $user->getKey(),
            'created_by' => $user->getKey(),
            'service_type' => $validated['service_type'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'status' => ServiceOrderStatus::Pending->value,
            'price' => $validated['amount'],
            'currency' => 'BRL',
            'metadata' => $validated['metadata'] ?? [],
            'purchased_at' => now(),
        ]);

        $transaction = PaymentTransaction::query()->create([
            'user_id' => $user->getKey(),
            'service_order_id' => $order->getKey(),
            'provider' => $validated['provider'],
            'method' => $validated['method'],
            'direction' => 'customer_payment',
            'amount' => $validated['amount'],
            'currency' => 'BRL',
            'status' => PaymentStatus::Pending->value,
            'metadata' => [],
        ]);

        $gatewayPayload = $payments->prepareGatewayPayload($transaction);
        $audit->record('payments.customer_created', $user, $user, $request, $transaction, [
            'service_order_id' => $order->getKey(),
            'provider' => $validated['provider'],
        ]);

        return response()->json([
            'message' => 'Pagamento criado e pedido registrado.',
            'data' => [
                'order' => $order->refresh(),
                'transaction' => $transaction->refresh(),
                'gateway' => $gatewayPayload,
            ],
        ], 201);
    }
}
