<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderChatMessage;
use App\Models\OrderConversation;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Orders\OrderChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderChatController extends Controller
{
    public function show(Request $request, ServiceOrder $serviceOrder, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorize($user, $serviceOrder);

        $conversation = $chat->ensureConversation($serviceOrder->loadMissing(['customer', 'booster']));

        if (! $conversation) {
            return response()->json([
                'message' => $serviceOrder->payment_status !== 'PAID'
                    ? 'O chat sera liberado apos a confirmacao do pagamento.'
                    : 'O chat sera liberado quando um booster assumir o pedido.',
                'data' => [
                    'available' => false,
                    'messages' => [],
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'available' => true,
                'conversation' => $this->serializeConversation($conversation),
                'messages' => $this->messagesQuery($conversation)->limit(200)->get(),
            ],
        ]);
    }

    public function store(Request $request, ServiceOrder $serviceOrder, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorize($user, $serviceOrder);
        $chat->assertCanSend($serviceOrder, $user);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $conversation = $chat->ensureConversation($serviceOrder);

        if (! $conversation) {
            return response()->json(['message' => 'Chat indisponivel para este pedido.'], 422);
        }

        $chat->assertConversationActive($conversation);
        $message = $chat->storeMessage($conversation, $user, $validated['body']);

        return response()->json([
            'data' => [
                'message' => $message,
            ],
        ], 201);
    }

    public function messages(Request $request, OrderConversation $conversation, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorizeConversation($user, $conversation);

        $perPage = min(max((int) $request->integer('per_page', 100), 1), 200);

        $messages = $this->messagesQuery($conversation)
            ->paginate($perPage);

        return response()->json([
            'data' => [
                'messages' => $messages,
            ],
        ]);
    }

    public function storeForConversation(Request $request, OrderConversation $conversation, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorizeConversation($user, $conversation);
        $chat->assertConversationActive($conversation);
        $chat->assertCanSend($conversation->serviceOrder, $user);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $message = $chat->storeMessage($conversation, $user, $validated['message']);

        return response()->json([
            'data' => [
                'message' => $message,
                'conversation' => $this->serializeConversation($conversation->refresh()),
            ],
        ], 201);
    }

    public function read(Request $request, OrderConversation $conversation, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorizeConversation($user, $conversation);

        $count = $chat->markRead($conversation, $user);

        return response()->json([
            'data' => [
                'read_count' => $count,
            ],
        ]);
    }

    public function pin(Request $request, OrderConversation $conversation, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorizeConversation($user, $conversation);
        $chat->assertCanPin($user, $conversation);
        $chat->assertConversationActive($conversation);

        $validated = $request->validate([
            'message_id' => ['nullable', 'integer', 'exists:order_chat_messages,id'],
        ]);

        $message = isset($validated['message_id'])
            ? OrderChatMessage::query()->findOrFail($validated['message_id'])
            : null;

        $conversation = $chat->pinMessage($conversation, $message);

        return response()->json([
            'data' => [
                'conversation' => $this->serializeConversation($conversation),
            ],
        ]);
    }

    private function messagesQuery(OrderConversation $conversation)
    {
        return OrderChatMessage::query()
            ->where('order_conversation_id', $conversation->getKey())
            ->with('sender:id,name,email,role,profile_photo_path')
            ->oldest();
    }

    private function serializeConversation(OrderConversation $conversation): array
    {
        $conversation->loadMissing([
            'serviceOrder',
            'customer:id,name,email,role,profile_photo_path',
            'booster:id,name,email,role,profile_photo_path',
            'pinnedMessage.sender:id,name,email,role,profile_photo_path',
        ]);

        return [
            'id' => $conversation->getKey(),
            'orderId' => $conversation->service_order_id,
            'service_order_id' => $conversation->service_order_id,
            'clientId' => $conversation->customer_id,
            'customer_id' => $conversation->customer_id,
            'boosterId' => $conversation->booster_id,
            'booster_id' => $conversation->booster_id,
            'status' => $conversation->status ?? 'ACTIVE',
            'lastMessage' => $conversation->last_message,
            'lastMessageAt' => $conversation->last_message_at?->toIso8601String(),
            'pinnedMessageId' => $conversation->pinned_message_id,
            'pinned_message_id' => $conversation->pinned_message_id,
            'pinnedMessage' => $conversation->pinnedMessage,
            'pinned_message' => $conversation->pinnedMessage,
            'opened_at' => $conversation->opened_at?->toIso8601String(),
            'createdAt' => $conversation->created_at?->toIso8601String(),
            'created_at' => $conversation->created_at?->toIso8601String(),
            'updatedAt' => $conversation->updated_at?->toIso8601String(),
            'updated_at' => $conversation->updated_at?->toIso8601String(),
            'customer' => $conversation->customer,
            'booster' => $conversation->booster,
            'order' => $conversation->serviceOrder,
        ];
    }
}
