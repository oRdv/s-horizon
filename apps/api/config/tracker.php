<?php

return [
    'riot_api_key' => env('RIOT_API_KEY'),
    'riot_region' => env('RIOT_REGION', 'BR1'),
    'riot_regional_route' => env('RIOT_REGIONAL_ROUTE', 'AMERICAS'),
    'heartbeat_interval_seconds' => (int) env('TRACKER_HEARTBEAT_INTERVAL_SECONDS', 15),
    'allow_lcu' => (bool) env('TRACKER_ALLOW_LCU', true),
    'require_riot_account_match' => (bool) env('TRACKER_REQUIRE_RIOT_ACCOUNT_MATCH', true),
];
