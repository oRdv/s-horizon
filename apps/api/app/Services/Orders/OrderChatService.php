<?php

namespace App\Services\Orders;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\OrderChatMessage;
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
                'status' => 'ACTIVE',
                'opened_at' => now(),
            ],
        );

        $updates = [];

        if ((int) $conversation->booster_id !== (int) $order->booster_id) {
            $updates['booster_id'] = $order->booster_id;
        }

        if (! $conversation->status) {
            $updates['status'] = 'ACTIVE';
        }

        if ($updates !== []) {
            $conversation->forceFill($updates)->save();
        }

        $this->seedDevelopmentMessages($conversation);

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

    public function authorizeConversation(User $user, OrderConversation $conversation): void
    {
        $conversation->loadMissing('serviceOrder');

        if (
            (int) $conversation->customer_id === (int) $user->getKey()
            || (int) $conversation->booster_id === (int) $user->getKey()
            || $user->hasRole(UserRole::MasterAdmin)
            || $user->hasRole(UserRole::Staff)
        ) {
            return;
        }

        throw new AuthorizationException('Voce nao tem acesso a esta conversa.');
    }

    public function assertConversationActive(OrderConversation $conversation): void
    {
        if ($conversation->status !== 'ACTIVE') {
            throw ValidationException::withMessages([
                'conversation' => 'Esta conversa nao esta ativa.',
            ]);
        }
    }

    public function senderTypeFor(User $user): string
    {
        if ($user->hasRole(UserRole::Booster)) {
            return 'BOOSTER';
        }

        if ($user->hasRole(UserRole::MasterAdmin) || $user->hasRole(UserRole::Staff)) {
            return 'ADMIN';
        }

        return 'CLIENT';
    }

    public function assertCanPin(User $user, OrderConversation $conversation): void
    {
        if ((int) $conversation->booster_id === (int) $user->getKey() || $user->hasRole(UserRole::MasterAdmin) || $user->hasRole(UserRole::Staff)) {
            return;
        }

        throw new AuthorizationException('Apenas o booster pode fixar mensagens nesta conversa.');
    }

    public function pinMessage(OrderConversation $conversation, ?OrderChatMessage $message): OrderConversation
    {
        if ($message && (int) $message->order_conversation_id !== (int) $conversation->getKey()) {
            throw ValidationException::withMessages([
                'message' => 'Mensagem nao pertence a esta conversa.',
            ]);
        }

        $conversation->forceFill([
            'pinned_message_id' => $message?->getKey(),
        ])->save();

        return $conversation->refresh();
    }

    public function storeMessage(OrderConversation $conversation, User $user, string $body): OrderChatMessage
    {
        $message = OrderChatMessage::query()->create([
            'order_conversation_id' => $conversation->getKey(),
            'sender_id' => $user->getKey(),
            'sender_type' => $this->senderTypeFor($user),
            'body' => trim($body),
            'is_read' => false,
        ])->load('sender:id,name,email,role,profile_photo_path');

        $conversation->forceFill([
            'last_message' => $message->body,
            'last_message_at' => $message->created_at,
        ])->save();

        return $message;
    }

    public function markRead(OrderConversation $conversation, User $user): int
    {
        return OrderChatMessage::query()
            ->where('order_conversation_id', $conversation->getKey())
            ->where('sender_id', '!=', $user->getKey())
            ->whereNull('read_at')
            ->update([
                'is_read' => true,
                'read_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function isChatAvailable(ServiceOrder $order): bool
    {
        return $order->payment_status === 'PAID' && filled($order->booster_id);
    }

    private function seedDevelopmentMessages(OrderConversation $conversation): void
    {
        if (app()->environment('production') || env('CHAT_DEV_SEED') !== true) {
            return;
        }

        if ($conversation->messages()->exists()) {
            return;
        }

        $conversation->loadMissing(['customer', 'booster']);

        if (! $conversation->customer || ! $conversation->booster) {
            return;
        }

        $now = now();
        $messages = [
            [
                'order_conversation_id' => $conversation->getKey(),
                'sender_id' => $conversation->customer_id,
                'sender_type' => 'CLIENT',
                'body' => 'Oi! Pedido confirmado por aqui. Pode me chamar quando for começar.',
                'is_read' => true,
                'read_at' => $now,
                'created_at' => $now->copy()->subMinutes(4),
                'updated_at' => $now->copy()->subMinutes(4),
            ],
            [
                'order_conversation_id' => $conversation->getKey(),
                'sender_id' => $conversation->booster_id,
                'sender_type' => 'BOOSTER',
                'body' => 'Perfeito. Vou acompanhar os detalhes do pedido e aviso antes de iniciar.',
                'is_read' => false,
                'read_at' => null,
                'created_at' => $now->copy()->subMinutes(2),
                'updated_at' => $now->copy()->subMinutes(2),
            ],
        ];

        OrderChatMessage::query()->insert($messages);

        $conversation->forceFill([
            'last_message' => $messages[1]['body'],
            'last_message_at' => $messages[1]['created_at'],
        ])->save();
    }
}
