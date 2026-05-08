<?php

namespace App\Http\Controllers\Api;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ServiceOrderController extends Controller
{
    public function claim(
        Request $request,
        ServiceOrder $serviceOrder,
        AccountAuditService $audit,
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
                ServiceOrderStatus::Pending->value,
                ServiceOrderStatus::Paid->value,
            ], true)) {
                throw ValidationException::withMessages([
                    'order' => 'Esse servico nao esta mais disponivel na fila.',
                ]);
            }

            $order->forceFill([
                'booster_id' => $user->getKey(),
                'status' => ServiceOrderStatus::Assigned->value,
            ])->save();

            return $order->refresh()->loadMissing(['customer:id,name,email,role', 'booster:id,name,email,role']);
        });

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
}
