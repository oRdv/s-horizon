<?php

namespace Tests\Feature;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\AccountAuditLog;
use App\Models\BoosterTrackerSession;
use App\Models\ServiceOrder;
use App\Models\TrackedMatch;
use App\Models\User;
use App\Services\Auth\TokenPairService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BoosterTrackerFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_booster_tracker_release_events_download_heartbeat_and_match_flow(): void
    {
        $customer = $this->user(UserRole::Customer, 'tracker-customer@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'tracker-booster@horizonboost.gg');
        $token = $this->token($booster);
        $installerPath = storage_path('framework/testing/Horizon-Boost-Tracker.zip');
        File::ensureDirectoryExists(dirname($installerPath));
        File::put($installerPath, 'tracker-binary');

        config([
            'tracker.download.provider' => 'local',
            'tracker.download.version' => '1.2.3-test',
            'tracker.download.windows.path' => $installerPath,
            'tracker.download.windows.filename' => 'Horizon-Boost-Tracker-test.zip',
        ]);

        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'booster_id' => $booster->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Boost Ferro para Bronze',
            'status' => ServiceOrderStatus::BoosterAssigned->value,
            'price' => 100,
            'payment_status' => 'PAID',
            'metadata' => [
                'current_tier' => 'iron',
                'current_division' => 'IV',
                'target_tier' => 'bronze',
                'target_division' => 'IV',
            ],
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/booster-tracker/release?platform=windows')
            ->assertOk()
            ->assertJsonPath('data.version', '1.2.3-test')
            ->assertJsonPath('data.downloads.windows.available', true)
            ->assertJsonPath('data.downloads.windows.provider', 'local');

        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.release_viewed',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/booster-tracker/events', [
                'type' => 'setup_opened',
                'platform' => 'windows',
                'metadata' => ['active_orders' => 1],
            ])
            ->assertOk()
            ->assertJsonPath('data.event', 'setup_opened');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->get('/api/booster-tracker/download/windows')
            ->assertOk()
            ->assertDownload('Horizon-Boost-Tracker-test.zip');

        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.download_started',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/booster-tracker/heartbeat', [
                'orderId' => $order->getKey(),
                'status' => 'CLIENT_OPEN',
                'riotAccount' => [
                    'gameName' => 'Horizon',
                    'tagLine' => 'BR1',
                    'summonerName' => 'Horizon',
                    'puuid' => 'puuid-tracker-test',
                    'region' => 'BR1',
                ],
                'rankedProgress' => [
                    'tier' => 'iron',
                    'division' => 'IV',
                    'leaguePoints' => 24,
                    'queueType' => 'RANKED_SOLO_5x5',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.session.status', 'CLIENT_OPEN');

        $this->assertDatabaseHas((new BoosterTrackerSession())->getTable(), [
            'booster_id' => $booster->getKey(),
            'service_order_id' => $order->getKey(),
            'status' => 'CLIENT_OPEN',
            'riot_puuid' => 'puuid-tracker-test',
        ]);
        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.heartbeat_started',
        ]);
        $this->assertSame(ServiceOrderStatus::InProgress->value, $order->refresh()->status);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/booster-tracker/heartbeat', [
                'orderId' => $order->getKey(),
                'status' => 'IN_GAME',
                'currentGame' => [
                    'gameId' => 'game-123',
                    'queueId' => 420,
                    'championId' => 99,
                    'startedAt' => now()->subMinutes(30)->toIso8601String(),
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.session.status', 'IN_GAME');

        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.status_changed',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/booster-tracker/match-finished', [
                'orderId' => $order->getKey(),
                'gameId' => 'game-123',
                'riotPuuid' => 'puuid-tracker-test',
                'championId' => 99,
                'queueId' => 420,
                'result' => 'UNKNOWN',
                'startedAt' => now()->subMinutes(30)->toIso8601String(),
                'endedAt' => now()->toIso8601String(),
                'durationSeconds' => 1800,
            ])
            ->assertOk()
            ->assertJsonPath('data.match.game_id', 'game-123');

        $this->assertDatabaseHas((new TrackedMatch())->getTable(), [
            'booster_id' => $booster->getKey(),
            'service_order_id' => $order->getKey(),
            'game_id' => 'game-123',
            'result' => 'UNKNOWN',
        ]);
        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.match_finished',
        ]);

        File::delete($installerPath);
    }

    public function test_tracker_download_returns_clear_error_when_release_file_is_missing(): void
    {
        $booster = $this->user(UserRole::Booster, 'tracker-missing@horizonboost.gg');

        config([
            'tracker.download.provider' => 'local',
            'tracker.download.windows.path' => storage_path('framework/testing/missing-tracker.zip'),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($booster))
            ->getJson('/api/booster-tracker/download/windows')
            ->assertNotFound()
            ->assertJsonPath('data.download.available', false);

        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.download_unavailable',
        ]);
    }

    public function test_tracker_release_can_resolve_github_release_and_redirect_signed_download(): void
    {
        $booster = $this->user(UserRole::Booster, 'tracker-github@horizonboost.gg');

        config([
            'tracker.download.provider' => 'github',
            'tracker.download.cache_seconds' => 0,
            'tracker.download.github.owner' => 'oRdv',
            'tracker.download.github.repo' => 's-horizon',
            'tracker.download.windows.asset_regex' => '/^Horizon-Boost-Tracker-Setup-.+\.exe$/i',
        ]);

        Http::fake([
            'https://api.github.com/repos/oRdv/s-horizon/releases/latest' => Http::response([
                'tag_name' => 'v1.4.0',
                'published_at' => '2026-06-24T12:00:00Z',
                'html_url' => 'https://github.com/oRdv/s-horizon/releases/tag/v1.4.0',
                'assets' => [
                    [
                        'name' => 'Horizon-Boost-Tracker-Setup-1.4.0.exe',
                        'size' => 94371840,
                        'content_type' => 'application/vnd.microsoft.portable-executable',
                        'digest' => 'sha256:abc123',
                        'browser_download_url' => 'https://github.com/oRdv/s-horizon/releases/download/v1.4.0/Horizon-Boost-Tracker-Setup-1.4.0.exe',
                    ],
                ],
            ], 200),
        ]);

        $release = $this->withHeader('Authorization', 'Bearer '.$this->token($booster))
            ->getJson('/api/booster-tracker/release?platform=windows')
            ->assertOk()
            ->assertJsonPath('data.downloads.windows.available', true)
            ->assertJsonPath('data.downloads.windows.provider', 'github')
            ->assertJsonPath('data.downloads.windows.version', '1.4.0')
            ->assertJsonPath('data.downloads.windows.sha256', 'abc123')
            ->json('data.downloads.windows');

        $this->assertNotEmpty($release['url']);
        $this->assertArrayNotHasKey('direct_url', $release);
        $this->assertArrayNotHasKey('path', $release);

        $this->get($release['url'])
            ->assertRedirect('https://github.com/oRdv/s-horizon/releases/download/v1.4.0/Horizon-Boost-Tracker-Setup-1.4.0.exe');

        $this->assertDatabaseHas((new AccountAuditLog())->getTable(), [
            'user_id' => $booster->getKey(),
            'action' => 'tracker.download_started',
        ]);
    }

    public function test_tracker_release_can_use_generic_external_storage_without_local_file(): void
    {
        $booster = $this->user(UserRole::Booster, 'tracker-cdn@horizonboost.gg');

        config([
            'tracker.download.provider' => 'generic',
            'tracker.download.version' => '2.0.0',
            'tracker.download.generic.base_url' => 'https://cdn.horizonboost.test/tracker',
            'tracker.download.windows.filename' => 'Horizon-Boost-Tracker-Setup-2.0.0.exe',
            'tracker.download.windows.sha256' => 'sha256-cdn',
        ]);

        $release = $this->withHeader('Authorization', 'Bearer '.$this->token($booster))
            ->getJson('/api/booster-tracker/release?platform=windows')
            ->assertOk()
            ->assertJsonPath('data.downloads.windows.available', true)
            ->assertJsonPath('data.downloads.windows.provider', 'generic')
            ->assertJsonPath('data.downloads.windows.version', '2.0.0')
            ->json('data.downloads.windows');

        $this->assertArrayNotHasKey('direct_url', $release);
        $this->assertArrayNotHasKey('path', $release);

        $this->get($release['url'])
            ->assertRedirect('https://cdn.horizonboost.test/tracker/Horizon-Boost-Tracker-Setup-2.0.0.exe');
    }

    public function test_tracker_release_and_download_are_restricted_to_boosters(): void
    {
        $customer = $this->user(UserRole::Customer, 'tracker-customer-blocked@horizonboost.gg');

        $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->getJson('/api/booster-tracker/release?platform=windows')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->getJson('/api/booster-tracker/download/windows')
            ->assertForbidden();
    }

    public function test_signed_tracker_download_rejects_invalid_or_non_booster_user(): void
    {
        $customer = $this->user(UserRole::Customer, 'tracker-signed-customer@horizonboost.gg');

        config([
            'tracker.download.provider' => 'generic',
            'tracker.download.version' => '2.0.0',
            'tracker.download.generic.base_url' => 'https://cdn.horizonboost.test/tracker',
            'tracker.download.windows.filename' => 'Horizon-Boost-Tracker-Setup-2.0.0.exe',
        ]);

        $signedForCustomer = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'tracker.download.signed',
            now()->addMinutes(10),
            [
                'platform' => 'windows',
                'user' => $customer->getKey(),
            ],
        );

        $this->getJson($signedForCustomer)->assertForbidden();
        $this->getJson('/api/booster-tracker/downloads/windows/signed?user='.$customer->getKey())
            ->assertForbidden();
    }

    private function user(UserRole $role, string $email): User
    {
        return User::factory()->create([
            'email' => $email,
            'role' => $role->value,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
    }

    private function token(User $user): string
    {
        return app(TokenPairService::class)->issueForUser($user)->accessToken;
    }
}
