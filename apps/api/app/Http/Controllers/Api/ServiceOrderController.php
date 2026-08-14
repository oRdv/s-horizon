<?php

namespace App\Http\Controllers\Api;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Notifications\OrderNotificationService;
use App\Services\Orders\ClaimOrderService;
use App\Services\Orders\OrderChatService;
use App\Services\Payments\PaymentService;
use App\Services\Audit\AccountAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

class ServiceOrderController extends Controller
{
    public function index(Request $request, OrderChatService $chat, PaymentService $payments): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->hasRole(UserRole::Customer) || $user->hasRole(UserRole::MasterAdmin)) {
            $payments->reconcilePendingMercadoPagoPayments();
        }

        $query = ServiceOrder::query()
            ->with([
                'customer:id,name,email,role,profile_photo_path',
                'booster:id,name,email,role,profile_photo_path',
                'payments' => fn ($query) => $query->latest(),
                'conversation',
                'latestTrackerSession',
            ])
            ->latest();

        if ($user->hasRole(UserRole::Customer)) {
            $query->where('customer_id', $user->getKey());
        } elseif ($user->hasRole(UserRole::Booster)) {
            $query->where('booster_id', $user->getKey());
        } elseif (! $user->hasRole(UserRole::MasterAdmin) && ! $user->hasRole(UserRole::Staff)) {
            return response()->json(['message' => 'Perfil sem acesso aos pedidos.'], 403);
        }

        $orders = $query->get()->map(fn (ServiceOrder $order): array => $this->serializeOrder($order, $chat));

        return response()->json(['data' => ['orders' => $orders]]);
    }

    public function show(Request $request, ServiceOrder $serviceOrder, OrderChatService $chat, PaymentService $payments): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canViewOrder($user, $serviceOrder)) {
            return response()->json([
                'message' => 'Voce nao tem acesso a este pedido.',
            ], 403);
        }

        if ($user->hasRole(UserRole::Customer) || $user->hasRole(UserRole::MasterAdmin)) {
            $payments->reconcilePendingMercadoPagoPayments();
            $serviceOrder->refresh();
        }

        return response()->json([
            'data' => [
                'order' => $this->serializeOrder($serviceOrder->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                    'latestTrackerSession',
                ]), $chat),
            ],
        ]);
    }

    public function claim(
        Request $request,
        ServiceOrder $serviceOrder,
        AccountAuditService $audit,
        OrderChatService $chat,
        ClaimOrderService $claimOrders,
        OrderNotificationService $notifications,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $claimedOrder = $claimOrders->claim($serviceOrder, $user);

        $chat->ensureConversation($claimedOrder);

        $audit->record('orders.claimed_by_booster', $claimedOrder->customer, $user, $request, $claimedOrder, [
            'service_order_id' => $claimedOrder->getKey(),
        ]);

        $notifications->assigned($claimedOrder, ['email']);
        $notifications->claimed($claimedOrder);

        return response()->json([
            'message' => 'Servico pego com sucesso.',
            'data' => [
                'order' => $this->serializeOrder($claimedOrder->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                    'latestTrackerSession',
                ]), $chat),
            ],
        ]);
    }

    public function complete(
        Request $request,
        ServiceOrder $serviceOrder,
        AccountAuditService $audit,
        OrderChatService $chat,
        OrderNotificationService $notifications,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole(UserRole::Booster)) {
            return response()->json([
                'message' => 'Somente boosters podem finalizar serviços.',
            ], 403);
        }

        if ((int) $serviceOrder->booster_id !== (int) $user->getKey()) {
            return response()->json([
                'message' => 'Esse serviço não está atribuído a você.',
            ], 403);
        }

        if (! in_array($serviceOrder->status, [
            ServiceOrderStatus::BoosterAssigned->value,
            ServiceOrderStatus::Assigned->value,
            ServiceOrderStatus::InProgress->value,
        ], true)) {
            throw ValidationException::withMessages([
                'order' => 'Esse serviço não pode ser finalizado nesse status.',
            ]);
        }

        $serviceOrder->forceFill([
            'status' => ServiceOrderStatus::Completed->value,
            'completed_at' => now(),
        ])->save();

        $audit->record('orders.completed_by_booster', $serviceOrder->customer, $user, $request, $serviceOrder, [
            'service_order_id' => $serviceOrder->getKey(),
        ]);

        $notifications->completed($serviceOrder->refresh()->loadMissing(['customer', 'booster']));

        return response()->json([
            'message' => 'Serviço finalizado com sucesso.',
            'data' => [
                'order' => $this->serializeOrder($serviceOrder->refresh()->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                    'latestTrackerSession',
                ]), $chat),
            ],
        ]);
    }

    public function storeGameAccount(
        Request $request,
        ServiceOrder $serviceOrder,
        OrderChatService $chat,
        OrderNotificationService $notifications,
    ): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorize($user, $serviceOrder);

        if ((int) $serviceOrder->customer_id !== (int) $user->getKey() && ! $user->hasRole(UserRole::MasterAdmin) && ! $user->hasRole(UserRole::Staff)) {
            return response()->json([
                'message' => 'Somente o cliente dono do pedido pode enviar os dados da conta.',
            ], 403);
        }

        if ($serviceOrder->payment_status !== 'PAID') {
            throw ValidationException::withMessages([
                'order' => 'Confirme o pagamento antes de enviar os dados da conta.',
            ]);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $metadata = $serviceOrder->metadata ?? [];
        $metadata['game_account'] = [
            'email' => $validated['email'],
            'password_encrypted' => Crypt::encryptString($validated['password']),
            'submitted_at' => now()->toIso8601String(),
        ];

        $serviceOrder->forceFill(['metadata' => $metadata])->save();

        $notifications->gameAccountUpdated($serviceOrder->refresh()->loadMissing(['customer', 'booster']));

        return response()->json([
            'message' => 'Dados da conta salvos com segurança.',
            'data' => [
                'order' => $this->serializeOrder($serviceOrder->refresh()->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                    'latestTrackerSession',
                ]), $chat),
            ],
        ]);
    }

    private function serializeOrder(ServiceOrder $order, OrderChatService $chat): array
    {
        $latestPayment = $order->payments->sortByDesc('created_at')->first();
        $metadata = $order->metadata ?? [];
        $hasGameAccount = filled(data_get($metadata, 'game_account.email')) && filled(data_get($metadata, 'game_account.password_encrypted'));

        if (isset($metadata['game_account']) && is_array($metadata['game_account'])) {
            unset($metadata['game_account']['password_encrypted']);
        }

        return [
            'id' => $order->getKey(),
            'service_type' => $order->service_type,
            'title' => $order->title,
            'description' => $order->description,
            'status' => $order->status,
            'price' => $order->price,
            'base_price' => $order->base_price,
            'final_price' => $order->final_price,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'currency' => $order->currency,
            'metadata' => $metadata,
            'has_game_account' => $hasGameAccount,
            'customer' => $order->customer,
            'booster' => $order->booster,
            'created_at' => $order->created_at?->toIso8601String(),
            'updated_at' => $order->updated_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'chat_available' => $chat->isChatAvailable($order),
            'conversation_id' => $order->conversation?->getKey(),
            'latest_payment' => $latestPayment,
            'tracker_status' => $order->latestTrackerSession ? [
                'id' => $order->latestTrackerSession->getKey(),
                'status' => $order->latestTrackerSession->status,
                'last_heartbeat_at' => $order->latestTrackerSession->last_heartbeat_at?->toIso8601String(),
                'riot_account' => [
                    'gameName' => $order->latestTrackerSession->game_name,
                    'tagLine' => $order->latestTrackerSession->tag_line,
                    'summonerName' => $order->latestTrackerSession->summoner_name,
                    'region' => $order->latestTrackerSession->region,
                ],
                'current_game' => [
                    'gameId' => $order->latestTrackerSession->current_game_id,
                    'queueId' => $order->latestTrackerSession->current_queue_id,
                    'championId' => $order->latestTrackerSession->current_champion_id,
                    'startedAt' => $order->latestTrackerSession->started_at?->toIso8601String(),
                ],
                'ranked_progress' => [
                    'snapshot' => $order->latestTrackerSession->ranked_snapshot,
                    'lpDelta' => $order->latestTrackerSession->lp_delta,
                    'progressPercent' => (float) $order->latestTrackerSession->progress_percent,
                ],
            ] : null,
        ];
    }

    private function canViewOrder(User $user, ServiceOrder $order): bool
    {
        if (
            (int) $order->customer_id === (int) $user->getKey()
            || (int) $order->booster_id === (int) $user->getKey()
            || $user->hasRole(UserRole::MasterAdmin)
            || $user->hasRole(UserRole::Staff)
        ) {
            return true;
        }

        if (! $user->hasRole(UserRole::Booster) || ! $user->is_active || filled($order->booster_id)) {
            return false;
        }

        if (filled(data_get($order->metadata ?? [], 'addons.favorite_booster'))) {
            return false;
        }

        return in_array($order->status, [
            ServiceOrderStatus::Paid->value,
            ServiceOrderStatus::WaitingBooster->value,
        ], true);
    }
}
