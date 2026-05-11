<?php

namespace Tests\Feature;

use App\Enums\UserRole;
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

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/admin/users/'.$target->getKey())
            ->assertOk();

        $this->assertDatabaseMissing('users', [
            'id' => $target->getKey(),
        ]);
    }

    private function loginToken(string $email, string $password): string
    {
        return (string) $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ])->assertOk()->json('access_token');
    }
}
