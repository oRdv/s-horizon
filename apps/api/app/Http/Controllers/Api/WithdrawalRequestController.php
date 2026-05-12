<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\WithdrawalStatus;
use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\Audit\AccountAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WithdrawalRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = WithdrawalRequest::query()->with([
            'booster:id,name,email,role',
            'booster.boosterProfile:id,user_id,pix_key',
            'reviewer:id,name,email,role',
        ]);

        if (! $user->hasPermission('finance.withdrawals.manage')) {
            $query->where('booster_id', $user->getKey());
        }

        return response()->json([
            'data' => [
                'withdrawals' => $query->latest()->paginate(20),
            ],
        ]);
    }

    public function store(Request $request, AccountAuditService $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole(UserRole::Booster)) {
            return response()->json([
                'message' => 'Somente boosters podem solicitar saque.',
            ], 403);
        }

        $validated = $request->validate([
            'service_order_id' => ['nullable', 'integer', 'exists:service_orders,id'],
            'amount' => ['required_without:service_order_id', 'numeric', 'min:1'],
            'method' => ['required', Rule::in(['pix', 'card'])],
            'pix_key' => ['nullable', 'string', 'max:255'],
            'bonus_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $metadata = $validated['metadata'] ?? [];
        $amount = $validated['amount'] ?? null;
        $pixKey = $validated['pix_key'] ?? $user->boosterProfile?->pix_key;

        if (isset($validated['service_order_id'])) {
            $order = ServiceOrder::query()
                ->whereKey($validated['service_order_id'])
                ->where('booster_id', $user->getKey())
                ->firstOrFail();

            if ($order->status !== 'COMPLETED') {
                throw ValidationException::withMessages([
                    'service_order_id' => 'Finalize o serviço antes de solicitar saque.',
                ]);
            }

            $alreadyRequested = WithdrawalRequest::query()
                ->where('booster_id', $user->getKey())
                ->whereIn('status', [
                    WithdrawalStatus::Pending->value,
                    WithdrawalStatus::Approved->value,
                    WithdrawalStatus::Paid->value,
                ])
                ->get()
                ->contains(fn (WithdrawalRequest $withdrawal): bool => (int) data_get($withdrawal->metadata ?? [], 'service_order_id') === (int) $order->getKey());

            if ($alreadyRequested) {
                throw ValidationException::withMessages([
                    'service_order_id' => 'Esse boost já possui uma solicitação de saque.',
                ]);
            }

            $grossAmount = $order->final_price ? ((int) $order->final_price / 100) : (float) $order->price;
            $basePayout = round($grossAmount * 0.6, 2);
            $bonusAmount = round((float) ($validated['bonus_amount'] ?? 0), 2);
            $amount = round($basePayout + $bonusAmount, 2);
            $metadata = array_merge($metadata, [
                'service_order_id' => $order->getKey(),
                'service_order_title' => $order->title,
                'source' => 'completed_boost',
                'payout_percent' => 60,
                'gross_amount' => $grossAmount,
                'base_payout_amount' => $basePayout,
                'bonus_amount' => $bonusAmount,
                'pix_key' => $pixKey,
            ]);
        }

        $withdrawal = WithdrawalRequest::query()->create([
            'booster_id' => $user->getKey(),
            'amount' => $amount,
            'method' => $validated['method'],
            'pix_key' => $pixKey,
            'notes' => $validated['notes'] ?? null,
            'metadata' => $metadata,
            'status' => WithdrawalStatus::Pending->value,
            'requested_at' => now(),
        ]);

        $audit->record('withdrawals.requested', $user, $user, $request, $withdrawal);

        return response()->json([
            'message' => 'Solicitação de pagamento enviada.',
            'data' => [
                'withdrawal' => $withdrawal,
            ],
        ], 201);
    }

    public function review(Request $request, WithdrawalRequest $withdrawalRequest, AccountAuditService $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'status' => ['required', Rule::in([WithdrawalStatus::Approved->value, WithdrawalStatus::Rejected->value, WithdrawalStatus::Paid->value])],
            'rejection_reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $withdrawalRequest->forceFill([
            'status' => $validated['status'],
            'reviewed_by' => $user->getKey(),
            'reviewed_at' => now(),
            'rejection_reason' => $validated['rejection_reason'] ?? null,
        ])->save();

        $audit->record('withdrawals.reviewed', $withdrawalRequest->booster, $user, $request, $withdrawalRequest, [
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'Solicitação financeira revisada.',
            'data' => [
                'withdrawal' => $withdrawalRequest->refresh(),
            ],
        ]);
    }
}
