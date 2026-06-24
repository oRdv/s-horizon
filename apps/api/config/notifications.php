<?php

return [
    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')),

    'channels' => [
        'email' => [
            'enabled' => (bool) env('NOTIFICATIONS_EMAIL_ENABLED', true),
        ],

        'discord' => [
            'enabled' => (bool) env('DISCORD_NOTIFICATIONS_ENABLED', false),
            'webhook_url' => env('DISCORD_ORDERS_WEBHOOK_URL'),
            'username' => env('DISCORD_NOTIFICATIONS_USERNAME', 'Horizon Boost'),
            'avatar_url' => env('DISCORD_NOTIFICATIONS_AVATAR_URL'),
            'booster_role_id' => env('DISCORD_BOOSTER_ROLE_ID'),
            'timeout_seconds' => (int) env('DISCORD_NOTIFICATIONS_TIMEOUT_SECONDS', 5),
        ],
    ],
];
