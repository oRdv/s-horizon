<?php

namespace App\Services\Notifications\Channels;

use App\Mail\PlainNotificationMail;
use App\Models\User;
use App\Services\Notifications\NotificationChannel;
use App\Services\Notifications\NotificationMessage;
use Illuminate\Support\Facades\Mail;

final class EmailNotificationChannel implements NotificationChannel
{
    public function name(): string
    {
        return 'email';
    }

    public function isEnabled(): bool
    {
        return (bool) config('notifications.channels.email.enabled', true);
    }

    /**
     * @param iterable<int,User> $recipients
     */
    public function send(NotificationMessage $message, iterable $recipients = []): void
    {
        foreach ($recipients as $recipient) {
            if (! $recipient->email) {
                continue;
            }

            $body = $message->body;
            if ($message->actionUrl) {
                $body .= "\n\nAcesse: {$message->actionUrl}";
            }

            Mail::to($recipient->email)->send(new PlainNotificationMail($message->title, $body));
        }
    }
}
