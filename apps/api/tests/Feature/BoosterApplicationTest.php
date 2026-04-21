<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoosterApplicationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_booster_application_creates_customer_and_pending_application(): void
    {
        $response = $this->postJson('/api/booster-applications/public', [
            ...$this->applicationPayload(),
            'name' => 'Public Candidate',
            'email' => 'public-candidate@horizonboost.gg',
            'password' => 'Horizon123!',
            'password_confirmation' => 'Horizon123!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('message', 'Inscrição enviada para análise.')
            ->assertJsonPath('data.user.email', 'public-candidate@horizonboost.gg')
            ->assertJsonPath('data.user.role', UserRole::Customer->value)
            ->assertJsonPath('data.application.status', 'pending');

        $this->assertDatabaseHas('users', [
            'email' => 'public-candidate@horizonboost.gg',
            'role' => UserRole::Customer->value,
        ]);

        $this->assertDatabaseHas('booster_applications', [
            'full_name' => 'Horizon Candidate',
            'in_game_nick' => 'HorizonCandidate',
            'status' => 'pending',
        ]);
    }

    public function test_customer_can_apply_and_master_admin_can_approve_application(): void
    {
        $customer = User::factory()->create([
            'email' => 'candidate@horizonboost.gg',
            'password' => 'Horizon123!',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $master = User::factory()->create([
            'email' => 'boosthorizon@gmail.com',
            'password' => 'boosthorizon123',
            'role' => UserRole::MasterAdmin->value,
            'is_active' => true,
        ]);

        $customerToken = $this->loginToken($customer->email, 'Horizon123!');

        $applicationId = $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->postJson('/api/booster-applications', $this->applicationPayload())
            ->assertCreated()
            ->assertJsonPath('data.application.status', 'pending')
            ->json('data.application.id');

        $masterToken = $this->loginToken($master->email, 'boosthorizon123');

        $this->withHeader('Authorization', 'Bearer '.$masterToken)
            ->getJson('/api/admin/booster-applications?status=pending')
            ->assertOk()
            ->assertJsonPath('data.applications.data.0.id', $applicationId);

        $this->withHeader('Authorization', 'Bearer '.$masterToken)
            ->patchJson('/api/admin/booster-applications/'.$applicationId.'/approve')
            ->assertOk()
            ->assertJsonPath('data.application.status', 'approved');

        $this->assertDatabaseHas('users', [
            'id' => $customer->getKey(),
            'role' => UserRole::Booster->value,
        ]);

        $this->assertDatabaseHas('booster_profiles', [
            'user_id' => $customer->getKey(),
            'in_game_nick' => 'HorizonCandidate',
            'pix_key' => 'candidate@pix.gg',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function applicationPayload(): array
    {
        return [
            'full_name' => 'Horizon Candidate',
            'birth_date' => '2001-05-10',
            'age' => 25,
            'cpf' => '123.456.789-10',
            'pix_key' => 'candidate@pix.gg',
            'gender' => 'prefer_not_to_say',
            'in_game_nick' => 'HorizonCandidate',
            'highest_rank' => 'Challenger',
            'previous_season_rank' => 'Grandmaster',
            'available_hours' => 'Todos os dias após 18h',
            'location' => 'Curitiba, PR',
            'accepts_riot_responsibility' => true,
            'accepts_confidentiality_terms' => true,
            'initial_percentage' => 65,
            'accepts_initial_percentage' => true,
            'opgg_url' => 'https://op.gg/summoners/br/HorizonCandidate',
            'discord_username' => 'horizoncandidate',
            'diamond_plus_eta' => '3 a 4 dias',
            'accepts_cashflow_decay' => true,
        ];
    }

    private function loginToken(string $email, string $password): string
    {
        return (string) $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ])->assertOk()->json('access_token');
    }
}
