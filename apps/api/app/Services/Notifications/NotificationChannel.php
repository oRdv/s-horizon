<?php

namespace App\Services\Notifications;

use App\Models\User;

interface NotificationChannel
{
    public function name(): string;

    public function isEnabled(): bool;

    /**
     * @param iterable<int,User> $recipients
     */
    public function send(NotificationMessage $message, iterable $recipients = []): void;
}
