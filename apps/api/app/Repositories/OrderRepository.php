<?php

namespace App\Repositories;

use App\Models\ServiceOrder;

final class OrderRepository
{
    public function findOwnedOrder(int $orderId, int $userId): ?ServiceOrder
    {
        return ServiceOrder::query()
            ->whereKey($orderId)
            ->where('customer_id', $userId)
            ->first();
    }

    public function findBoostForUser(int $boostId, int $userId): ?ServiceOrder
    {
        return ServiceOrder::query()
            ->whereKey($boostId)
            ->where('customer_id', $userId)
            ->first();
    }
}
