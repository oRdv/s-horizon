<?php

namespace Tests\Feature;

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
            'name' => 'New Booster',
            'email' => 'new-booster@horizonboost.gg',
            'password' => 'Horizon123!',
            'password_confirmation' => 'Horizon123!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('message', 'Conta criada com sucesso.')
            ->assertJsonPath('data.user.email', 'new-booster@horizonboost.gg')
            ->assertJsonPath('data.user.role', 'customer');

        $this->assertDatabaseHas('users', [
            'email' => 'new-booster@horizonboost.gg',
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
}
