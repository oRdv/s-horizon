<?php

namespace Database\Seeders;

use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\OrderConversation;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MockOrderSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(MockBoosterSeeder::class);

        $customer = User::query()->updateOrCreate([
            'email' => 'mock.cliente@horizonboost.com.br',
        ], [
            'name' => 'Cliente Temporário',
            'password' => Hash::make('Cliente@12345'),
            'role' => UserRole::Customer->value,
            'staff_profile' => null,
            'permissions' => null,
            'is_active' => true,
            'email_verified_at' => now(),
            'two_factor_enabled' => false,
            'two_factor_confirmed_at' => null,
            'approved_at' => now(),
        ]);

        $booster = User::query()
            ->where('email', 'mock.booster@horizonboost.com.br')
            ->firstOrFail();

        $order = ServiceOrder::query()->updateOrCreate([
            'title' => 'Mock LoL Solo Boost Prata IV para Ouro IV',
            'customer_id' => $customer->getKey(),
        ], [
            'booster_id' => $booster->getKey(),
            'created_by' => $customer->getKey(),
            'service_type' => 'solo_boost',
            'description' => 'Pedido temporário atribuído ao booster mockado para validar o tracker desktop e a área do booster.',
            'status' => ServiceOrderStatus::BoosterAssigned->value,
            'price' => 120.00,
            'base_price' => 12000,
            'final_price' => 12000,
            'payment_method' => 'pix',
            'payment_status' => PaymentStatus::Paid->value,
            'currency' => 'BRL',
            'metadata' => [
                'game' => 'lol',
                'calculator_mode' => 'solo',
                'calculator_family' => 'boost',
                'current_tier' => 'silver',
                'current_division' => 'IV',
                'target_tier' => 'gold',
                'target_division' => 'IV',
                'ladder_text' => 'Prata IV para Ouro IV',
                'quote_summary' => 'Pedido mockado para teste do tracker.',
                'estimated_delivery_days' => 3,
                'addons' => [
                    'chat_offline' => true,
                    'priority_service' => false,
                ],
            ],
            'purchased_at' => now()->subMinutes(20),
            'started_at' => null,
            'completed_at' => null,
        ]);

        OrderConversation::query()->updateOrCreate([
            'service_order_id' => $order->getKey(),
        ], [
            'customer_id' => $customer->getKey(),
            'booster_id' => $booster->getKey(),
            'status' => 'ACTIVE',
            'opened_at' => now()->subMinutes(20),
            'last_message' => 'Pedido mockado criado para teste do tracker.',
            'last_message_at' => now()->subMinutes(20),
        ]);
    }
}
