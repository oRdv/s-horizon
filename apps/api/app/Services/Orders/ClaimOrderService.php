<?php

namespace App\Services\Orders;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ClaimOrderService
{
    public function claim(ServiceOrder $serviceOrder, User $booster): ServiceOrder
    {
        if (! $booster->hasRole(UserRole::Booster) || ! $booster->is_active) {
            abort(403, 'Somente boosters ativos podem pegar servicos da fila.');
        }

        return DB::transaction(function () use ($serviceOrder, $booster): ServiceOrder {
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
                'booster_id' => $booster->getKey(),
                'status' => ServiceOrderStatus::BoosterAssigned->value,
            ])->save();

            return $order->refresh()->loadMissing(['customer:id,name,email,role', 'booster:id,name,email,role']);
        });
    }
}
