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
use Illuminate\Support\Facades\Crypt;
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
                'order' => $this->serializeOrder($claimedOrder->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                ]), $chat),
            ],
        ]);
    }

    public function complete(
        Request $request,
        ServiceOrder $serviceOrder,
        AccountAuditService $audit,
        OrderChatService $chat,
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

        return response()->json([
            'message' => 'Serviço finalizado com sucesso.',
            'data' => [
                'order' => $this->serializeOrder($serviceOrder->refresh()->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
                ]), $chat),
            ],
        ]);
    }

    public function storeGameAccount(Request $request, ServiceOrder $serviceOrder, OrderChatService $chat): JsonResponse
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

        return response()->json([
            'message' => 'Dados da conta salvos com segurança.',
            'data' => [
                'order' => $this->serializeOrder($serviceOrder->refresh()->loadMissing([
                    'customer:id,name,email,role,profile_photo_path',
                    'booster:id,name,email,role,profile_photo_path',
                    'payments',
                    'conversation',
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
        ];
    }
}
