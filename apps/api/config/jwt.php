<?php

return [
    'secret' => env('JWT_SECRET') ?: env('APP_KEY'),
    'issuer' => env('JWT_ISSUER', env('APP_NAME', 'horizon-boost-api')),
    'access_ttl' => (int) env('JWT_ACCESS_TTL', 15),
    'refresh_ttl' => (int) env('JWT_REFRESH_TTL', 60 * 24 * 30),
];
