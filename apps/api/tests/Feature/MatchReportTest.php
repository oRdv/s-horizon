<?php

namespace Tests\Feature;

use App\Models\MatchReport;
use App\Models\User;
use App\Services\Auth\TokenPairService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatchReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_store_match_reports(): void
    {
        $user = User::factory()->create();
        $tokenPair = app(TokenPairService::class)->issueForUser($user);

        $this->withHeader('Authorization', 'Bearer '.$tokenPair->accessToken)
            ->postJson('/api/matches', [
                'external_match_id' => 'LOL-123456',
                'result' => 'win',
                'duration' => 1820,
                'timestamp' => '2026-04-16T22:57:00Z',
                'source' => 'desktop-app',
                'payload' => [
                    'queue' => 'ranked_solo',
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.match.external_match_id', 'LOL-123456');

        $this->assertDatabaseHas((new MatchReport())->getTable(), [
            'user_id' => $user->getKey(),
            'external_match_id' => 'LOL-123456',
            'result' => 'win',
            'duration_seconds' => 1820,
        ]);
    }
}
