<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Enums\WithdrawalStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PaymentTransaction;
use App\Models\LandingBooster;
use App\Models\BoosterTrackerSession;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function master(): JsonResponse
    {
        return response()->json([
            'data' => [
                'summary' => [
                    'total_clients' => User::query()->where('role', UserRole::Customer->value)->count(),
                    'total_boosters' => User::query()->where('role', UserRole::Booster->value)->count(),
                    'total_staffs' => User::query()->where('role', UserRole::Staff->value)->count(),
                    'total_orders' => ServiceOrder::query()->count(),
                    'pending_payments' => Payment::query()->whereIn('status', [
                        PaymentStatus::Pending->value,
                        PaymentStatus::WaitingPayment->value,
                        PaymentStatus::Processing->value,
                        PaymentStatus::RequiresAction->value,
                    ])->count(),
                    'total_revenue' => (int) Payment::query()->where('status', PaymentStatus::Paid->value)->sum('final_amount'),
                    'pending_withdrawals' => WithdrawalRequest::query()->where('status', WithdrawalStatus::Pending->value)->count(),
                ],
                'global_goals' => [
                    'meta_faturamento_mes' => 18000,
                    'faturamento_atual_mes' => (int) Payment::query()
                        ->where('status', PaymentStatus::Paid->value)
                        ->whereMonth('created_at', now()->month)
                        ->sum('final_amount'),
                    'meta_pedidos_mes' => 55,
                    'pedidos_abertos_mes' => ServiceOrder::query()
                        ->whereMonth('created_at', now()->month)
                        ->count(),
                    'meta_boosters_ativos' => 12,
                    'boosters_ativos' => User::query()
                        ->where('role', UserRole::Booster->value)
                        ->where('is_active', true)
                        ->count(),
                ],
                'users_by_role' => User::query()
                    ->selectRaw('role, count(*) as total')
                    ->groupBy('role')
                    ->pluck('total', 'role'),
                'latest_users' => User::query()->latest()->limit(8)->get(),
                'pending_withdrawal_requests' => WithdrawalRequest::query()
                    ->with('booster:id,name,email,role')
                    ->where('status', WithdrawalStatus::Pending->value)
                    ->latest()
                    ->limit(8)
                    ->get(),
                'landing_boosters' => LandingBooster::query()
                    ->with('user:id,name,email,role')
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get(),
                'booster_users' => User::query()
                    ->where('role', UserRole::Booster->value)
                    ->orderBy('name')
                    ->get(['id', 'name', 'email', 'role']),
                'live_boosters' => BoosterTrackerSession::query()
                    ->with(['booster:id,name,email,role,profile_photo_path', 'serviceOrder:id,title,status'])
                    ->latest('last_heartbeat_at')
                    ->limit(12)
                    ->get()
                    ->map(fn (BoosterTrackerSession $session): array => [
                        'id' => $session->getKey(),
                        'status' => $session->status,
                        'booster' => $session->booster,
                        'order' => $session->serviceOrder,
                        'riot_account' => [
                            'gameName' => $session->game_name,
                            'tagLine' => $session->tag_line,
                            'summonerName' => $session->summoner_name,
                            'region' => $session->region,
                        ],
                        'current_game' => [
                            'gameId' => $session->current_game_id,
                            'queueId' => $session->current_queue_id,
                            'championId' => $session->current_champion_id,
                        ],
                        'ranked_progress' => [
                            'snapshot' => $session->ranked_snapshot,
                            'lpDelta' => $session->lp_delta,
                            'progressPercent' => (float) $session->progress_percent,
                        ],
                        'last_heartbeat_at' => $session->last_heartbeat_at?->toIso8601String(),
                    ]),
            ],
        ]);
    }

    public function staff(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'profile' => [
                    'staff_profile' => $user->staff_profile,
                    'permissions' => $user->effective_permissions,
                ],
                'operation' => [
                    'active_orders' => ServiceOrder::query()
                        ->whereIn('status', [
                            ServiceOrderStatus::Paid->value,
                            ServiceOrderStatus::WaitingBooster->value,
                            ServiceOrderStatus::BoosterAssigned->value,
                            ServiceOrderStatus::InProgress->value,
                        ])
                        ->count(),
                    'active_boosters' => User::query()
                        ->where('role', UserRole::Booster->value)
                        ->where('is_active', true)
                        ->count(),
                    'recent_orders' => ServiceOrder::query()
                        ->with(['customer:id,name,email', 'booster:id,name,email'])
                        ->latest()
                        ->limit(8)
                        ->get(),
                ],
                'finance' => [
                    'pending_withdrawals' => WithdrawalRequest::query()->where('status', WithdrawalStatus::Pending->value)->count(),
                    'pending_transactions' => Payment::query()->whereIn('status', [
                        PaymentStatus::Pending->value,
                        PaymentStatus::WaitingPayment->value,
                        PaymentStatus::Processing->value,
                        PaymentStatus::RequiresAction->value,
                    ])->count(),
                    'month_revenue' => (int) Payment::query()
                        ->where('status', PaymentStatus::Paid->value)
                        ->whereMonth('created_at', now()->month)
                        ->sum('final_amount'),
                ],
            ],
        ]);
    }

    public function booster(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $availableEarnings = (float) PaymentTransaction::query()
            ->where('user_id', $user->getKey())
            ->whereIn('direction', ['booster_earning', 'booster_bonus'])
            ->where('status', PaymentStatus::Paid->value)
            ->sum('amount');
        $availableOrders = ServiceOrder::query()
            ->with(['customer:id,name,email,role'])
            ->whereNull('booster_id')
            ->whereIn('status', [
                ServiceOrderStatus::Paid->value,
                ServiceOrderStatus::WaitingBooster->value,
            ])
            ->latest()
            ->limit(40)
            ->get()
            ->filter(fn (ServiceOrder $order): bool => blank(data_get($order->metadata ?? [], 'addons.favorite_booster')))
            ->values()
            ->take(12);

        return response()->json([
            'data' => [
                'available_orders' => $availableOrders,
                'assigned_orders' => ServiceOrder::query()
                    ->with(['customer:id,name,email,role'])
                    ->where('booster_id', $user->getKey())
                    ->latest()
                    ->get(),
                'progress' => [
                    'completed_orders' => ServiceOrder::query()
                        ->where('booster_id', $user->getKey())
                        ->where('status', ServiceOrderStatus::Completed->value)
                        ->count(),
                    'active_orders' => ServiceOrder::query()
                        ->where('booster_id', $user->getKey())
                        ->whereIn('status', [ServiceOrderStatus::BoosterAssigned->value, ServiceOrderStatus::InProgress->value])
                        ->count(),
                ],
                'earnings' => [
                    'available' => $availableEarnings,
                    'pending_withdrawals' => (float) WithdrawalRequest::query()
                        ->where('booster_id', $user->getKey())
                        ->where('status', WithdrawalStatus::Pending->value)
                        ->sum('amount'),
                ],
                'goals' => [],
            ],
        ]);
    }

    public function customer(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => [
                'orders' => ServiceOrder::query()
                    ->with('payments')
                    ->where('customer_id', $user->getKey())
                    ->latest()
                    ->get(),
                'payments' => Payment::query()
                    ->with('serviceOrder')
                    ->where('user_id', $user->getKey())
                    ->latest()
                    ->get(),
                'history' => [
                    'total_orders' => ServiceOrder::query()->where('customer_id', $user->getKey())->count(),
                    'completed_orders' => ServiceOrder::query()
                        ->where('customer_id', $user->getKey())
                        ->where('status', ServiceOrderStatus::Completed->value)
                        ->count(),
                ],
            ],
        ]);
    }
}
