<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::query()->updateOrCreate([
            'email' => 'boosthorizon@gmail.com',
        ], [
            'name' => 'Boost Horizon Master',
            'password' => Hash::make('boosthorizon123'),
            'role' => UserRole::MasterAdmin->value,
            'staff_profile' => null,
            'permissions' => null,
            'is_active' => true,
            'email_verified_at' => now(),
            'approved_at' => now(),
        ]);
    }
}
