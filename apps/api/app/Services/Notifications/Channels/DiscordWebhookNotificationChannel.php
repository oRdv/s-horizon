<?php

namespace App\Services\Notifications\Channels;

use App\Models\User;
use App\Services\Notifications\NotificationChannel;
use App\Services\Notifications\NotificationMessage;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class DiscordWebhookNotificationChannel implements NotificationChannel
{
    public function name(): string
    {
        return 'discord';
    }

    public function isEnabled(): bool
    {
        return (bool) config('notifications.channels.discord.enabled')
            && filled(config('notifications.channels.discord.webhook_url'));
    }

    /**
     * @param iterable<int,User> $recipients
     */
    public function send(NotificationMessage $message, iterable $recipients = []): void
    {
        $webhookUrl = (string) config('notifications.channels.discord.webhook_url');
        $backoffKey = $this->backoffKey($webhookUrl);
        $blockedUntil = Cache::get($backoffKey);

        if (is_int($blockedUntil) && $blockedUntil > now()->timestamp) {
            Log::info('notifications.discord_backoff_active', [
                'key' => $message->key,
                'retry_at' => $blockedUntil,
            ]);

            return;
        }

        $deliveryKey = $this->deliveryKey($message, $webhookUrl);
        $deliveryLock = null;

        if ($deliveryKey !== null) {
            $deliveryLock = Cache::lock($deliveryKey.'.lock', max(
                10,
                (int) config('notifications.channels.discord.timeout_seconds', 5) + 5,
            ));

            if (! $deliveryLock->get()) {
                Log::info('notifications.discord_delivery_in_progress', [
                    'key' => $message->key,
                ]);

                return;
            }

            if (Cache::has($deliveryKey)) {
                $deliveryLock->release();

                Log::info('notifications.discord_duplicate_skipped', [
                    'key' => $message->key,
                ]);

                return;
            }
        }

        try {
            $roleId = config('notifications.channels.discord.booster_role_id');
            $shouldMentionBoosters = (bool) ($message->context['mention_boosters'] ?? false) && filled($roleId);
            $discordUserId = $message->context['discord_user_id'] ?? null;
            $shouldMentionUser = ! $shouldMentionBoosters && is_string($discordUserId) && preg_match('/^\d{15,32}$/', $discordUserId) === 1;

            $payload = [
                'username' => (string) config('notifications.channels.discord.username', 'Serviços'),
                'avatar_url' => config('notifications.channels.discord.avatar_url'),
                'content' => $this->mentionContent($shouldMentionBoosters, (string) $roleId, $shouldMentionUser, (string) $discordUserId),
                'allowed_mentions' => [
                    'parse' => [],
                    'roles' => $shouldMentionBoosters ? [(string) $roleId] : [],
                    'users' => $shouldMentionUser ? [(string) $discordUserId] : [],
                ],
                'embeds' => [
                    [
                        'title' => $message->title,
                        'description' => $message->body,
                        'url' => $message->actionUrl,
                        'color' => $this->colorFor($message->key),
                        'fields' => $this->fieldsFor($message),
                        'timestamp' => now()->toIso8601String(),
                        'footer' => ['text' => 'Horizon Boost'],
                    ],
                ],
                'components' => $this->componentsFor($message),
            ];

            $response = Http::timeout((int) config('notifications.channels.discord.timeout_seconds', 5))
                ->acceptJson()
                ->post($this->webhookUrlWithComponents($webhookUrl), array_filter($payload, static fn ($value): bool => $value !== null && $value !== []));

            if ($response->status() === 429) {
                $retryAfterSeconds = $this->retryAfterSeconds($response);
                Cache::put($backoffKey, now()->addSeconds($retryAfterSeconds)->timestamp, $retryAfterSeconds);

                Log::warning('notifications.discord_rate_limited', [
                    'retry_after' => $retryAfterSeconds,
                    'bucket' => $response->header('X-RateLimit-Bucket'),
                ]);

                return;
            }

            if ($response->failed()) {
                Log::warning('notifications.discord_failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return;
            }

            if ($deliveryKey !== null) {
                Cache::forever($deliveryKey, true);
            }

            Log::info('notifications.discord_sent', [
                'key' => $message->key,
                'status' => $response->status(),
                'mentioned_boosters' => $shouldMentionBoosters,
                'mentioned_user' => $shouldMentionUser,
            ]);
        } finally {
            $deliveryLock?->release();
        }
    }

    /**
     * @return array<int,array{name:string,value:string,inline:bool}>
     */
    private function fieldsFor(NotificationMessage $message): array
    {
        $fields = [];

        foreach ([
            'order_id' => 'Pedido',
            'service' => 'Servico',
            'game' => 'Jogo',
            'queue' => 'Fila',
            'current_rank' => 'Elo atual',
            'desired_rank' => 'Elo desejado',
            'region' => 'Regiao',
            'route' => 'Rota',
            'price' => 'Valor',
            'total_price' => 'Valor total',
            'booster_value' => 'Valor booster',
            'restrictions' => 'Restricoes',
            'status' => 'Status',
            'customer' => 'Cliente',
            'booster' => 'Booster',
            'observation' => 'Observacao',
        ] as $key => $label) {
            $value = $message->context[$key] ?? null;
            if (filled($value)) {
                $fields[] = [
                    'name' => $label,
                    'value' => $this->truncateFieldValue((string) $value),
                    'inline' => ! in_array($key, ['restrictions', 'observation'], true),
                ];
            }
        }

        return $fields;
    }

    private function truncateFieldValue(string $value): string
    {
        return strlen($value) > 1024 ? substr($value, 0, 1021).'...' : $value;
    }

    private function colorFor(string $key): int
    {
        return match ($key) {
            'order.available' => 0x22c55e,
            'order.claimed' => 0xf59e0b,
            'order.assigned' => 0xf59e0b,
            'order.completed' => 0x38bdf8,
            default => 0xe11d48,
        };
    }

    /**
     * @return array<int,array{type:int,components:array<int,array{type:int,style:int,label:string,url:string}>}>
     */
    private function componentsFor(NotificationMessage $message): array
    {
        $actions = $message->context['discord_actions'] ?? [];

        if (! is_array($actions)) {
            return [];
        }

        if ($message->key === 'order.available') {
            $actions = array_values(array_filter(
                $actions,
                static fn ($action): bool => is_array($action) && ($action['label'] ?? null) === 'Pegar serviço',
            ));
        }

        $buttons = [];

        foreach ($actions as $action) {
            if (! is_array($action)) {
                continue;
            }

            $label = trim((string) ($action['label'] ?? ''));
            $url = trim((string) ($action['url'] ?? ''));

            if ($label === '' || ! $this->isSafeActionUrl($url)) {
                continue;
            }

            $buttons[] = [
                'type' => 2,
                'style' => 5,
                'label' => substr($label, 0, 80),
                'url' => substr($url, 0, 512),
            ];

            if (count($buttons) >= 5) {
                break;
            }
        }

        return $buttons === []
            ? []
            : [
                [
                    'type' => 1,
                    'components' => $buttons,
                ],
            ];
    }

    private function isSafeActionUrl(string $url): bool
    {
        return str_starts_with($url, 'https://') || str_starts_with($url, 'http://localhost') || str_starts_with($url, 'http://127.0.0.1');
    }

    private function mentionContent(bool $mentionBoosters, string $roleId, bool $mentionUser, string $discordUserId): ?string
    {
        if ($mentionBoosters) {
            return "<@&{$roleId}>";
        }

        if ($mentionUser) {
            return "<@{$discordUserId}>";
        }

        return null;
    }

    private function webhookUrlWithComponents(string $webhookUrl): string
    {
        return $webhookUrl.(str_contains($webhookUrl, '?') ? '&' : '?').'with_components=true';
    }

    private function backoffKey(string $webhookUrl): string
    {
        return 'notifications.discord.backoff.'.sha1($webhookUrl);
    }

    private function deliveryKey(NotificationMessage $message, string $webhookUrl): ?string
    {
        $deduplicationKey = $message->context['discord_deduplication_key'] ?? null;

        if (! is_string($deduplicationKey) || trim($deduplicationKey) === '') {
            return null;
        }

        return 'notifications.discord.delivered.'.sha1(
            $webhookUrl.'|'.$message->key.'|'.trim($deduplicationKey),
        );
    }

    private function retryAfterSeconds(Response $response): int
    {
        $retryAfter = $response->json('retry_after')
            ?? $response->header('Retry-After')
            ?? $response->header('X-RateLimit-Reset-After')
            ?? 5;
        $seconds = is_numeric($retryAfter) ? (float) $retryAfter : 5.0;

        if ($seconds > 1000) {
            $seconds = $seconds / 1000;
        }

        return max(1, (int) ceil($seconds));
    }
}
