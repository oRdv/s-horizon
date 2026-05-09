<?php

namespace App\Services\Orders;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\OrderConversation;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

final class OrderChatService
{
    public function ensureConversation(ServiceOrder $order): ?OrderConversation
    {
        if (! $this->isChatAvailable($order)) {
            return null;
        }

        $conversation = OrderConversation::query()->firstOrCreate(
            ['service_order_id' => $order->getKey()],
            [
                'customer_id' => $order->customer_id,
                'booster_id' => $order->booster_id,
                'opened_at' => now(),
            ],
        );

        if ((int) $conversation->booster_id !== (int) $order->booster_id) {
            $conversation->forceFill(['booster_id' => $order->booster_id])->save();
        }

        return $conversation;
    }

    public function authorize(User $user, ServiceOrder $order): void
    {
        if (
            (int) $order->customer_id === (int) $user->getKey()
            || (int) $order->booster_id === (int) $user->getKey()
            || $user->hasRole(UserRole::MasterAdmin)
            || $user->hasRole(UserRole::Staff)
        ) {
            return;
        }

        throw new AuthorizationException('Voce nao tem acesso ao chat deste pedido.');
    }

    public function assertCanSend(ServiceOrder $order): void
    {
        if (! $this->isChatAvailable($order)) {
            throw ValidationException::withMessages([
                'chat' => 'Chat disponivel apenas apos pagamento aprovado e booster designado.',
            ]);
        }

        if (in_array($order->status, [
            ServiceOrderStatus::Completed->value,
            ServiceOrderStatus::Cancelled->value,
        ], true)) {
            throw ValidationException::withMessages([
                'chat' => 'Nao e possivel enviar mensagens em pedido finalizado ou cancelado.',
            ]);
        }
    }

    public function isChatAvailable(ServiceOrder $order): bool
    {
        return $order->payment_status === 'PAID' && filled($order->booster_id);
    }
}
