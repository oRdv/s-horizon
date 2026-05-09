<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\WithdrawalStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\Audit\AccountAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WithdrawalRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = WithdrawalRequest::query()->with(['booster:id,name,email,role', 'reviewer:id,name,email,role']);

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
            'amount' => ['required', 'numeric', 'min:1'],
            'method' => ['required', Rule::in(['pix', 'card'])],
            'pix_key' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ]);

        $withdrawal = WithdrawalRequest::query()->create([
            'booster_id' => $user->getKey(),
            'amount' => $validated['amount'],
            'method' => $validated['method'],
            'pix_key' => $validated['pix_key'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'metadata' => $validated['metadata'] ?? [],
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
