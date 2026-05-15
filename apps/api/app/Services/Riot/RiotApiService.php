<?php

namespace App\Services\Riot;

use Illuminate\Support\Facades\Http;

class RiotApiService
{
    public function accountByRiotId(string $gameName, string $tagLine, ?string $regionalRoute = null): ?array
    {
        if (! $this->hasApiKey()) {
            return null;
        }

        $route = strtolower($regionalRoute ?: config('tracker.riot_regional_route', 'AMERICAS'));
        $response = Http::withHeaders($this->headers())
            ->timeout(8)
            ->get("https://{$route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{$gameName}/{$tagLine}");

        return $response->successful() ? $response->json() : null;
    }

    public function matchById(string $matchId, ?string $regionalRoute = null): ?array
    {
        if (! $this->hasApiKey()) {
            return null;
        }

        $route = strtolower($regionalRoute ?: config('tracker.riot_regional_route', 'AMERICAS'));
        $response = Http::withHeaders($this->headers())
            ->timeout(10)
            ->get("https://{$route}.api.riotgames.com/lol/match/v5/matches/{$matchId}");

        return $response->successful() ? $response->json() : null;
    }

    public function hasApiKey(): bool
    {
        return filled(config('tracker.riot_api_key'));
    }

    private function headers(): array
    {
        return [
            'X-Riot-Token' => (string) config('tracker.riot_api_key'),
            'Accept' => 'application/json',
        ];
    }
}
