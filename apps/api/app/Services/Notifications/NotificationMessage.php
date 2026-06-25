<?php

namespace App\Services\Notifications;

final readonly class NotificationMessage
{
    /**
     * @param array<string,mixed> $context
     * @param array<int,string> $channels
     */
    public function __construct(
        public string $key,
        public string $title,
        public string $body,
        public ?string $actionUrl = null,
        public array $context = [],
        public array $channels = ['email', 'discord'],
    ) {
    }
}
