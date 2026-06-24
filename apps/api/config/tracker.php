<?php

return [
    'riot_api_key' => env('RIOT_API_KEY'),
    'riot_region' => env('RIOT_REGION', 'BR1'),
    'riot_regional_route' => env('RIOT_REGIONAL_ROUTE', 'AMERICAS'),
    'heartbeat_interval_seconds' => (int) env('TRACKER_HEARTBEAT_INTERVAL_SECONDS', 15),
    'allow_lcu' => (bool) env('TRACKER_ALLOW_LCU', true),
    'require_riot_account_match' => (bool) env('TRACKER_REQUIRE_RIOT_ACCOUNT_MATCH', true),
    'download' => [
        'provider' => env('TRACKER_DOWNLOAD_PROVIDER', 'github'),
        'cache_seconds' => (int) env('TRACKER_RELEASE_CACHE_SECONDS', 300),
        'signed_url_ttl_minutes' => (int) env('TRACKER_DOWNLOAD_SIGNED_URL_TTL_MINUTES', 10),
        'version' => env('TRACKER_APP_VERSION', '0.0.0-local'),
        'github' => [
            'owner' => env('TRACKER_GITHUB_OWNER', 'oRdv'),
            'repo' => env('TRACKER_GITHUB_REPO', 's-horizon'),
            'tag' => env('TRACKER_GITHUB_RELEASE_TAG'),
            'token' => env('TRACKER_GITHUB_TOKEN'),
        ],
        'generic' => [
            'base_url' => env('TRACKER_GENERIC_RELEASE_BASE_URL'),
        ],
        'windows' => [
            'filename' => env('TRACKER_WINDOWS_FILENAME', 'Horizon-Boost-Tracker-Setup.exe'),
            'path' => env('TRACKER_WINDOWS_DOWNLOAD_PATH', public_path('downloads/horizon-boost-tracker-windows.zip')),
            'sha256' => env('TRACKER_WINDOWS_SHA256'),
            'asset_name' => env('TRACKER_WINDOWS_ASSET_NAME'),
            'asset_regex' => env('TRACKER_WINDOWS_ASSET_REGEX', '/^Horizon-Boost-Tracker-Setup-.+\.exe$/i'),
        ],
    ],
];
