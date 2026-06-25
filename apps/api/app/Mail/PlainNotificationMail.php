<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailable;

final class PlainNotificationMail extends Mailable
{
    public function __construct(
        public readonly string $subjectLine,
        public readonly string $bodyText,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(
            text: 'emails.plain-notification',
            with: [
                'bodyText' => $this->bodyText,
            ],
        );
    }
}
