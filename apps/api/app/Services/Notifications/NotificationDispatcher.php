<?php

namespace App\Services\Notifications;

use App\Models\User;
use App\Services\Notifications\Channels\DiscordWebhookNotificationChannel;
use App\Services\Notifications\Channels\EmailNotificationChannel;
use Illuminate\Support\Facades\Log;
use Throwable;

final class NotificationDispatcher
{
    /**
     * @var array<string,NotificationChannel>
     */
    private array $channels;

    public function __construct(
        EmailNotificationChannel $email,
        DiscordWebhookNotificationChannel $discord,
    ) {
        $this->channels = [
            $email->name() => $email,
            $discord->name() => $discord,
        ];
    }

    /**
     * @param iterable<int,User> $recipients
     * @param array<int,string>|null $channels
     */
    public function dispatch(NotificationMessage $message, iterable $recipients = [], ?array $channels = null): void
    {
        $selectedChannels = $channels ?? $message->channels;

        foreach ($selectedChannels as $channelName) {
            $channel = $this->channels[$channelName] ?? null;

            if (! $channel || ! $channel->isEnabled()) {
                continue;
            }

            try {
                $channel->send($message, $recipients);
            } catch (Throwable $exception) {
                Log::warning('notifications.channel_failed', [
                    'channel' => $channelName,
                    'key' => $message->key,
                    'message' => $exception->getMessage(),
                ]);
            }
        }
    }
}
