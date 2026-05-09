<?php

namespace App\Http\Controllers\Api;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Orders\OrderChatService;
use App\Services\Audit\AccountAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ServiceOrderController extends Controller
{
    public function index(Request $request, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = ServiceOrder::query()
            ->with([
                'customer:id,name,email,role,profile_photo_path',
                'booster:id,name,email,role,profile_photo_path',
                'payments' => fn ($query) => $query->latest(),
                'conversation',
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

    public function show(Request $request, ServiceOrder $serviceOrder, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorize($user, $serviceOrder);

        return response()->json([
            'data' => [
                'order' => $this->serializeOrder($serviceOrder->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                ]), $chat),
            ],
        ]);
    }

    public function claim(
        Request $request,
        ServiceOrder $serviceOrder,
        AccountAuditService $audit,
        OrderChatService $chat,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole(UserRole::Booster)) {
            return response()->json([
                'message' => 'Somente boosters podem pegar servicos da fila.',
            ], 403);
        }

        $claimedOrder = DB::transaction(function () use ($serviceOrder, $user): ServiceOrder {
            /** @var ServiceOrder|null $order */
            $order = ServiceOrder::query()
                ->with(['customer:id,name,email,role', 'booster:id,name,email,role'])
                ->lockForUpdate()
                ->find($serviceOrder->getKey());

            if (! $order) {
                abort(404);
            }

            $favoriteBooster = data_get($order->metadata ?? [], 'addons.favorite_booster');

            if (filled($favoriteBooster)) {
                throw ValidationException::withMessages([
                    'order' => 'Esse servico esta reservado para um booster favorito.',
                ]);
            }

            if ($order->booster_id) {
                throw ValidationException::withMessages([
                    'order' => 'Esse servico ja foi pego por outro booster.',
                ]);
            }

            if (! in_array($order->status, [
                ServiceOrderStatus::Paid->value,
                ServiceOrderStatus::WaitingBooster->value,
            ], true)) {
                throw ValidationException::withMessages([
                    'order' => 'Esse servico nao esta mais disponivel na fila.',
                ]);
            }

            $order->forceFill([
                'booster_id' => $user->getKey(),
                'status' => ServiceOrderStatus::BoosterAssigned->value,
            ])->save();

            return $order->refresh()->loadMissing(['customer:id,name,email,role', 'booster:id,name,email,role']);
        });

        $chat->ensureConversation($claimedOrder);

        $audit->record('orders.claimed_by_booster', $claimedOrder->customer, $user, $request, $claimedOrder, [
            'service_order_id' => $claimedOrder->getKey(),
        ]);

        return response()->json([
            'message' => 'Servico pego com sucesso.',
            'data' => [
                'order' => $claimedOrder,
            ],
        ]);
    }

    private function serializeOrder(ServiceOrder $order, OrderChatService $chat): array
    {
        $latestPayment = $order->payments->sortByDesc('created_at')->first();

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
            'metadata' => $order->metadata,
            'customer' => $order->customer,
            'booster' => $order->booster,
            'created_at' => $order->created_at?->toIso8601String(),
            'updated_at' => $order->updated_at?->toIso8601String(),
            'chat_available' => $chat->isChatAvailable($order),
            'conversation_id' => $order->conversation?->getKey(),
            'latest_payment' => $latestPayment,
        ];
    }
}
