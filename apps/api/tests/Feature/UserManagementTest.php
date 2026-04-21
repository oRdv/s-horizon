<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\TournamentRegistration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_admin_can_update_and_delete_users(): void
    {
        $master = User::factory()->create([
            'email' => 'boosthorizon@gmail.com',
            'password' => 'boosthorizon123',
            'role' => UserRole::MasterAdmin->value,
            'is_active' => true,
        ]);

        $target = User::factory()->create([
            'email' => 'cliente@horizonboost.gg',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $token = $this->loginToken($master->email, 'boosthorizon123');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->patchJson('/api/admin/users/'.$target->getKey(), [
                'name' => 'Booster Editado',
                'email' => 'booster.editado@horizonboost.gg',
                'role' => UserRole::Booster->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.user.email', 'booster.editado@horizonboost.gg')
            ->assertJsonPath('data.user.role', UserRole::Booster->value);

        $this->assertDatabaseHas('users', [
            'id' => $target->getKey(),
            'name' => 'Booster Editado',
            'email' => 'booster.editado@horizonboost.gg',
            'role' => UserRole::Booster->value,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/admin/users/'.$target->getKey())
            ->assertOk();

        $this->assertDatabaseMissing('users', [
            'id' => $target->getKey(),
        ]);
    }

    public function test_master_admin_cannot_delete_own_logged_account(): void
    {
        $master = User::factory()->create([
            'email' => 'boosthorizon@gmail.com',
            'password' => 'boosthorizon123',
            'role' => UserRole::MasterAdmin->value,
            'is_active' => true,
        ]);

        $token = $this->loginToken($master->email, 'boosthorizon123');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/admin/users/'.$master->getKey())
            ->assertUnprocessable();

        $this->assertDatabaseHas('users', [
            'id' => $master->getKey(),
        ]);
    }

    public function test_master_admin_can_save_booster_profile_data(): void
    {
        $master = User::factory()->create([
            'email' => 'boosthorizon@gmail.com',
            'password' => 'boosthorizon123',
            'role' => UserRole::MasterAdmin->value,
            'is_active' => true,
        ]);

        $target = User::factory()->create([
            'email' => 'future-booster@horizonboost.gg',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $token = $this->loginToken($master->email, 'boosthorizon123');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->patchJson('/api/admin/users/'.$target->getKey(), [
                'name' => 'Booster Completo',
                'email' => 'booster-completo@horizonboost.gg',
                'role' => UserRole::Booster->value,
                'booster_profile' => [
                    'full_name' => 'Booster Completo da Silva',
                    'birth_date' => '2000-04-20',
                    'age' => 26,
                    'cpf' => '123.456.789-10',
                    'pix_key' => 'booster@pix.gg',
                    'gender' => 'prefer_not_to_say',
                    'in_game_nick' => 'HorizonCarry',
                    'highest_rank' => 'Challenger',
                    'previous_season_rank' => 'Grandmaster',
                    'available_hours' => 'Segunda a sexta, 19h às 23h',
                    'location' => 'São Paulo, SP',
                    'accepts_riot_responsibility' => true,
                    'accepts_confidentiality_terms' => true,
                    'initial_percentage' => 65,
                    'accepts_initial_percentage' => true,
                    'opgg_url' => 'https://op.gg/summoners/br/HorizonCarry',
                    'discord_username' => 'horizoncarry',
                    'diamond_plus_eta' => '3 a 5 dias',
                    'accepts_cashflow_decay' => true,
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.user.booster_profile.full_name', 'Booster Completo da Silva')
            ->assertJsonPath('data.user.booster_profile.in_game_nick', 'HorizonCarry');

        $this->assertDatabaseHas('booster_profiles', [
            'user_id' => $target->getKey(),
            'full_name' => 'Booster Completo da Silva',
            'pix_key' => 'booster@pix.gg',
            'accepts_cashflow_decay' => true,
        ]);
    }

    public function test_master_admin_can_view_tournament_registrations(): void
    {
        $master = User::factory()->create([
            'email' => 'boosthorizon@gmail.com',
            'password' => 'boosthorizon123',
            'role' => UserRole::MasterAdmin->value,
            'is_active' => true,
        ]);

        $customer = User::factory()->create([
            'email' => 'team-owner@horizonboost.gg',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $registration = TournamentRegistration::query()->create([
            'user_id' => $customer->getKey(),
            'game' => 'lol',
            'category_id' => 'lol-5v5',
            'category_title' => 'League of Legends 5v5',
            'status' => 'pending',
            'team_name' => 'Horizon Eclipse',
            'team_tag' => 'HRZ',
            'captain_name' => 'Capitão Horizon',
            'captain_email' => 'captain@horizonboost.gg',
            'captain_phone' => '(11) 99999-9999',
            'captain_discord' => '@captain',
            'server' => 'BR',
            'team_discord' => 'https://discord.gg/horizon',
            'how_found' => 'Discord',
            'roster' => [
                ['nick' => 'Top Horizon', 'riot_id' => 'Top#BR1', 'role' => 'Top', 'rank' => 'Diamante'],
                ['nick' => 'Jg Horizon', 'riot_id' => 'Jg#BR1', 'role' => 'Jungle', 'rank' => 'Diamante'],
                ['nick' => 'Mid Horizon', 'riot_id' => 'Mid#BR1', 'role' => 'Mid', 'rank' => 'Diamante'],
                ['nick' => 'Adc Horizon', 'riot_id' => 'Adc#BR1', 'role' => 'ADC', 'rank' => 'Diamante'],
                ['nick' => 'Sup Horizon', 'riot_id' => 'Sup#BR1', 'role' => 'Suporte', 'rank' => 'Diamante'],
            ],
            'notes' => 'Time disponível à noite.',
            'accepted_rules' => true,
            'accepted_check_in' => true,
            'submitted_at' => now(),
        ]);

        $token = $this->loginToken($master->email, 'boosthorizon123');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/tournament-registrations')
            ->assertOk()
            ->assertJsonPath('data.summary.total', 1)
            ->assertJsonPath('data.summary.teams', 1)
            ->assertJsonPath('data.registrations.data.0.team_name', 'Horizon Eclipse')
            ->assertJsonPath('data.registrations.data.0.user.email', 'team-owner@horizonboost.gg');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/tournament-registrations/'.$registration->getKey())
            ->assertOk()
            ->assertJsonPath('data.registration.roster.0.riot_id', 'Top#BR1')
            ->assertJsonPath('data.registration.user.email', 'team-owner@horizonboost.gg');
    }

    private function loginToken(string $email, string $password): string
    {
        return (string) $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ])->assertOk()->json('access_token');
    }
}
