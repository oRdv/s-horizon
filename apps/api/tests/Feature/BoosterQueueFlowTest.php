<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Auth\TokenPairService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoosterQueueFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_booster_dashboard_lists_available_orders_and_filters_reserved_orders(): void
    {
        $customer = $this->user(UserRole::Customer, 'cliente-queue@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-queue@horizonboost.gg');

        $availableOrder = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Prata para Ouro',
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'price' => 199.90,
            'base_price' => 19990,
            'final_price' => 19990,
            'payment_status' => PaymentStatus::Paid->value,
            'metadata' => [
                'current_tier' => 'silver',
                'current_division' => 'IV',
                'target_tier' => 'gold',
                'target_division' => 'IV',
            ],
        ]);

        ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Pedido reservado',
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'price' => 299.90,
            'base_price' => 29990,
            'final_price' => 29990,
            'payment_status' => PaymentStatus::Paid->value,
            'metadata' => [
                'addons' => [
                    'favorite_booster' => 'preferred-booster',
                ],
            ],
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($booster))
            ->getJson('/api/dashboards/booster')
            ->assertOk()
            ->assertJsonCount(1, 'data.available_orders')
            ->assertJsonPath('data.available_orders.0.id', $availableOrder->getKey())
            ->assertJsonPath('data.available_orders.0.customer.id', $customer->getKey());
    }

    public function test_active_booster_can_open_available_order_from_discord_link(): void
    {
        $customer = $this->user(UserRole::Customer, 'cliente-discord-link@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-discord-link@horizonboost.gg');

        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Prata para Ouro',
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'price' => 199.90,
            'base_price' => 19990,
            'final_price' => 19990,
            'payment_status' => PaymentStatus::Paid->value,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($booster))
            ->getJson('/api/orders/'.$order->getKey())
            ->assertOk()
            ->assertJsonPath('data.order.id', $order->getKey())
            ->assertJsonPath('data.order.booster', null);
    }

    public function test_discord_order_link_does_not_allow_unauthorized_or_inactive_claims(): void
    {
        $customer = $this->user(UserRole::Customer, 'cliente-discord-secure@horizonboost.gg');
        $activeBooster = $this->user(UserRole::Booster, 'booster-active-discord@horizonboost.gg');
        $otherBooster = $this->user(UserRole::Booster, 'booster-other-discord@horizonboost.gg');
        $inactiveBooster = $this->user(UserRole::Booster, 'booster-inactive-discord@horizonboost.gg');
        $inactiveBooster->forceFill(['is_active' => false])->save();

        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Ouro para Platina',
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'price' => 249.90,
            'base_price' => 24990,
            'final_price' => 24990,
            'payment_status' => PaymentStatus::Paid->value,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->postJson('/api/orders/'.$order->getKey().'/claim')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$this->token($inactiveBooster))
            ->postJson('/api/orders/'.$order->getKey().'/claim')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$this->token($activeBooster))
            ->postJson('/api/orders/'.$order->getKey().'/claim')
            ->assertOk()
            ->assertJsonPath('data.order.booster.id', $activeBooster->getKey());

        $this->withHeader('Authorization', 'Bearer '.$this->token($otherBooster))
            ->postJson('/api/orders/'.$order->getKey().'/claim')
            ->assertUnprocessable()
            ->assertJsonPath('errors.order.0', 'Esse servico ja foi pego por outro booster.');

        $this->withHeader('Authorization', 'Bearer '.$this->token($inactiveBooster))
            ->getJson('/api/orders/'.$order->getKey())
            ->assertForbidden();
    }

    private function user(UserRole $role, string $email): User
    {
        return User::factory()->create([
            'email' => $email,
            'role' => $role->value,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
    }

    private function token(User $user): string
    {
        return app(TokenPairService::class)->issueForUser($user)->accessToken;
    }
}
