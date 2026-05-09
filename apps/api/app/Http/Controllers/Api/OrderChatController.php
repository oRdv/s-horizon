<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderChatMessage;
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
                'data' => [
                    'available' => false,
                    'messages' => [],
                ],
            ]);
        }

        $messages = $conversation->messages()
            ->with('sender:id,name,email,role,profile_photo_path')
            ->oldest()
            ->limit(200)
            ->get();

        return response()->json([
            'data' => [
                'available' => true,
                'conversation' => $conversation->loadMissing(['customer:id,name,email,role,profile_photo_path', 'booster:id,name,email,role,profile_photo_path']),
                'messages' => $messages,
            ],
        ]);
    }

    public function store(Request $request, ServiceOrder $serviceOrder, OrderChatService $chat): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $chat->authorize($user, $serviceOrder);
        $chat->assertCanSend($serviceOrder);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $conversation = $chat->ensureConversation($serviceOrder);

        if (! $conversation) {
            return response()->json(['message' => 'Chat indisponivel para este pedido.'], 422);
        }

        $message = OrderChatMessage::query()->create([
            'order_conversation_id' => $conversation->getKey(),
            'sender_id' => $user->getKey(),
            'body' => trim($validated['body']),
        ])->load('sender:id,name,email,role,profile_photo_path');

        return response()->json([
            'data' => [
                'message' => $message,
            ],
        ], 201);
    }
}
