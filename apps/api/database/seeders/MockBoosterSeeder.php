<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\BoosterProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MockBoosterSeeder extends Seeder
{
    public function run(): void
    {
        $booster = User::query()->updateOrCreate([
            'email' => 'mock.booster@horizonboost.com.br',
        ], [
            'name' => 'Booster Temporário',
            'password' => Hash::make('Boost@12345'),
            'role' => UserRole::Booster->value,
            'staff_profile' => null,
            'permissions' => null,
            'is_active' => true,
            'email_verified_at' => now(),
            'two_factor_enabled' => false,
            'two_factor_confirmed_at' => null,
            'approved_at' => now(),
        ]);

        BoosterProfile::query()->updateOrCreate([
            'user_id' => $booster->getKey(),
        ], [
            'full_name' => 'Booster Temporário',
            'birth_date' => '1998-01-15',
            'age' => 28,
            'cpf' => '000.000.000-00',
            'pix_key' => 'mock.booster@horizonboost.com.br',
            'gender' => 'Não informado',
            'in_game_nick' => 'MockBooster#BR1',
            'highest_rank' => 'Challenger',
            'previous_season_rank' => 'Grandmaster',
            'available_hours' => 'Segunda a sexta, das 18h às 23h.',
            'location' => 'Brasil',
            'accepts_riot_responsibility' => true,
            'accepts_confidentiality_terms' => true,
            'initial_percentage' => 65,
            'accepts_initial_percentage' => true,
            'opgg_url' => 'https://www.op.gg/summoners/br/MockBooster-BR1',
            'discord_username' => 'mockbooster',
            'diamond_plus_eta' => 'Até 48h',
            'accepts_cashflow_decay' => true,
        ]);
    }
}
