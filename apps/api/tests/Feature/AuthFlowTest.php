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
            ->assertJsonPath('data.user.role', 'customer')
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
            'role' => 'customer',
        ]);
    }

    public function test_register_returns_clear_validation_errors(): void
    {
        User::factory()->create([
            'email' => 'taken@horizonboost.gg',
        ]);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Taken Booster',
            'email' => 'taken@horizonboost.gg',
            'password' => 'short',
            'password_confirmation' => 'different',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Este email já está cadastrado. Tente entrar ou use outro email.')
            ->assertJsonPath('errors.password.0', 'A senha precisa ter pelo menos 8 caracteres.')
            ->assertJsonPath('errors.password.1', 'A confirmação da senha não confere.');
    }

    public function test_user_can_login_and_fetch_authenticated_profile(): void
    {
        $user = User::factory()->create([
            'email' => 'pilot@horizonboost.gg',
            'password' => 'Horizon123!',
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
                'token_type',
                'expires_in',
                'refresh_expires_in',
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

    public function test_protected_routes_require_a_valid_access_token(): void
    {
        $this->getJson('/api/me')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'O access token não foi informado.');
    }

    public function test_customer_can_create_payment_order_but_cannot_access_withdrawals(): void
    {
        $customer = User::factory()->create([
            'email' => 'cliente-compras@horizonboost.gg',
            'password' => 'Horizon123!',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $token = (string) $this->postJson('/api/auth/login', [
            'email' => $customer->email,
            'password' => 'Horizon123!',
        ])->assertOk()->json('access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/payments/customer', [
                'service_type' => 'soloqueue_boost',
                'title' => 'Soloqueue Boost',
                'description' => 'Pedido criado pela tabela de preços.',
                'amount' => 149,
                'provider' => 'mercado_pago',
                'method' => 'pix',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Pagamento criado e pedido registrado.');

        $this->assertDatabaseHas('service_orders', [
            'customer_id' => $customer->getKey(),
            'service_type' => 'soloqueue_boost',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('payment_transactions', [
            'user_id' => $customer->getKey(),
            'direction' => 'customer_payment',
            'status' => 'pending',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/withdrawals')
            ->assertForbidden()
            ->assertJsonPath('message', 'Você não tem permissão para acessar este recurso.');
    }

    public function test_customer_can_submit_tournament_registration(): void
    {
        $customer = User::factory()->create([
            'email' => 'cliente-campeonato@horizonboost.gg',
            'password' => 'Horizon123!',
            'role' => UserRole::Customer->value,
            'is_active' => true,
        ]);

        $token = (string) $this->postJson('/api/auth/login', [
            'email' => $customer->email,
            'password' => 'Horizon123!',
        ])->assertOk()->json('access_token');

        $payload = [
            'game' => 'lol',
            'category_id' => 'lol-5v5',
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
        ];

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/tournament-registrations', $payload)
            ->assertCreated()
            ->assertJsonPath('message', 'Inscrição enviada para conferência.')
            ->assertJsonPath('data.registration.category_title', 'League of Legends 5v5')
            ->assertJsonPath('data.registration.team_name', 'Horizon Eclipse');

        $this->assertDatabaseHas('tournament_registrations', [
            'user_id' => $customer->getKey(),
            'game' => 'lol',
            'category_id' => 'lol-5v5',
            'team_name' => 'Horizon Eclipse',
            'status' => 'pending',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/tournament-registrations')
            ->assertOk()
            ->assertJsonPath('data.registrations.data.0.team_name', 'Horizon Eclipse');
    }

    public function test_master_admin_cannot_request_withdrawal_for_self(): void
    {
        $master = User::factory()->create([
            'email' => 'master-withdrawal@horizonboost.gg',
            'password' => 'Horizon123!',
            'role' => UserRole::MasterAdmin->value,
            'is_active' => true,
        ]);

        $token = (string) $this->postJson('/api/auth/login', [
            'email' => $master->email,
            'password' => 'Horizon123!',
        ])->assertOk()->json('access_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/withdrawals', [
                'amount' => 100,
                'method' => 'pix',
            ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Somente boosters podem solicitar saque.');
    }
}
