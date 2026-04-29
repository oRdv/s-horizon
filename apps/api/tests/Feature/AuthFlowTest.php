<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_with_customer_role(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New Cliente',
            'email' => 'new-cliente@horizonboost.gg',
            'password' => 'Horizon123!',
            'password_confirmation' => 'Horizon123!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('message', 'Conta criada com sucesso.')
            ->assertJsonPath('data.user.email', 'new-cliente@horizonboost.gg')
            ->assertJsonPath('data.user.role', UserRole::Customer->value)
            ->assertJsonPath('data.email_verification.token_sent', true)
            ->assertJsonStructure([
                'access_token',
                'refresh_token',
                'expires_in',
                'refresh_expires_in',
                'data' => [
                    'email_verification' => ['dev_token'],
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'new-cliente@horizonboost.gg',
            'role' => UserRole::Customer->value,
        ]);
    }

    public function test_user_can_login_and_fetch_authenticated_profile(): void
    {
        $user = User::factory()->create([
            'email' => 'pilot@horizonboost.gg',
            'password' => 'Horizon123!',
            'is_active' => true,
        ]);

        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Horizon123!',
        ]);

        $loginResponse
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'name', 'email'],
                ],
                'access_token',
                'refresh_token',
            ]);

        $this->withHeader('Authorization', 'Bearer '.$loginResponse->json('access_token'))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.user.email', $user->email);
    }

    public function test_refresh_token_is_rotated_automatically(): void
    {
        $user = User::factory()->create([
            'email' => 'refresh@horizonboost.gg',
            'password' => 'Horizon123!',
            'is_active' => true,
        ]);

        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Horizon123!',
        ]);

        $refreshResponse = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $loginResponse->json('refresh_token'),
        ]);

        $refreshResponse
            ->assertOk()
            ->assertJsonMissing([
                'refresh_token' => $loginResponse->json('refresh_token'),
            ]);

        $this->postJson('/api/auth/refresh', [
            'refresh_token' => $loginResponse->json('refresh_token'),
        ])->assertUnauthorized();

        $this->assertDatabaseCount((new RefreshToken())->getTable(), 2);
    }

    public function test_customer_can_submit_tournament_registration(): void
    {
        $customer = User::factory()->create([
            'email' => 'cliente-campeonato@horizonboost.gg',
            'password' => 'Horizon123!',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $token = $this->loginToken($customer->email, 'Horizon123!');

        $payload = [
            'game' => 'lol',
            'category_id' => 'lol-5v5',
            'team_name' => 'Horizon Eclipse',
            'team_tag' => 'HRZ',
            'captain_name' => 'Capitao Horizon',
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
            'notes' => 'Time disponivel a noite.',
            'accepted_rules' => true,
            'accepted_check_in' => true,
        ];

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/tournament-registrations', $payload)
            ->assertCreated()
            ->assertJsonPath('data.registration.category_title', 'League of Legends 5v5')
            ->assertJsonPath('data.registration.team_name', 'Horizon Eclipse');

        $this->assertDatabaseHas('tournament_registrations', [
            'user_id' => $customer->getKey(),
            'game' => 'lol',
            'category_id' => 'lol-5v5',
            'team_name' => 'Horizon Eclipse',
            'status' => 'pending',
        ]);
    }

    public function test_customer_cannot_access_withdrawals(): void
    {
        $customer = User::factory()->create([
            'email' => 'cliente-sem-saque@horizonboost.gg',
            'password' => 'Horizon123!',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $token = $this->loginToken($customer->email, 'Horizon123!');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/withdrawals')
            ->assertForbidden();
    }

    private function loginToken(string $email, string $password): string
    {
        return (string) $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ])->assertOk()->json('access_token');
    }
}
