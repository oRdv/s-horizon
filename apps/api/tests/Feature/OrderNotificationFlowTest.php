<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Mail\PlainNotificationMail;
use App\Models\LandingBooster;
use App\Models\Payment;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Notifications\OrderNotificationService;
use App\Services\Auth\TokenPairService;
use App\Services\Payments\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OrderNotificationFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_plain_notification_email_view_can_be_rendered(): void
    {
        $rendered = view('emails.plain-notification', [
            'bodyText' => 'Atualizacao privada do pedido.',
        ])->render();

        $this->assertStringContainsString('Atualizacao privada do pedido.', $rendered);
    }

    public function test_customer_selected_booster_receives_paid_wins_order_without_discord_notification(): void
    {
        Mail::fake();
        Http::fake();
        config([
            'notifications.channels.email.enabled' => true,
            'notifications.channels.discord.enabled' => true,
            'notifications.channels.discord.webhook_url' => 'https://discord.test/orders',
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-wins-direto@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-wins-direto@horizonboost.gg');
        LandingBooster::query()->create([
            'user_id' => $booster->getKey(),
            'nick' => 'Nome que não pode aparecer',
            'champion_name' => 'Ahri',
            'rank_label' => 'Diamante',
            'rank_key' => 'diamond',
            'game' => 'League of Legends',
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $wildRiftBooster = $this->user(UserRole::Booster, 'booster-wild-rift@horizonboost.gg');
        LandingBooster::query()->create([
            'user_id' => $wildRiftBooster->getKey(),
            'nick' => 'Outro nome privado',
            'champion_name' => 'Akshan',
            'rank_label' => 'Mestre',
            'rank_key' => 'master',
            'game' => 'Wild Rift',
            'sort_order' => 2,
            'is_active' => true,
        ]);
        $this->getJson('/api/boosters/selectable?game=lol')
            ->assertOk()
            ->assertJsonCount(1, 'data.boosters')
            ->assertJsonPath('data.boosters.0.id', $booster->getKey())
            ->assertJsonPath('data.boosters.0.name', 'Ahri')
            ->assertJsonMissing(['Nome que não pode aparecer'])
            ->assertJsonMissingPath('data.boosters.0.email')
            ->assertJsonMissingPath('data.boosters.0.effective_permissions');
        $this->getJson('/api/boosters/selectable?game=wild_rift')
            ->assertOk()
            ->assertJsonCount(1, 'data.boosters')
            ->assertJsonPath('data.boosters.0.id', $wildRiftBooster->getKey())
            ->assertJsonPath('data.boosters.0.name', 'Akshan');
        $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->postJson('/api/payments/customer', [
                'service_type' => 'wins_by_rank',
                'title' => 'Vitórias no Wild Rift',
                'amount' => 4900,
                'booster_id' => $booster->getKey(),
                'metadata' => ['game' => 'wild_rift'],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'BOOSTER_GAME_MISMATCH');
        $response = $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->postJson('/api/payments/customer', [
                'service_type' => 'wins_by_rank',
                'title' => 'Vitórias Duo Diamante IV',
                'amount' => 4900,
                'booster_id' => $booster->getKey(),
                'metadata' => ['game' => 'lol', 'queue' => 'duo'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.order.booster_id', $booster->getKey());

        $order = ServiceOrder::query()->findOrFail($response->json('data.order.id'));
        $payment = Payment::query()->create([
            'user_id' => $customer->getKey(),
            'order_id' => $order->getKey(),
            'boost_id' => $order->getKey(),
            'provider' => PaymentProvider::MercadoPago->value,
            'method' => PaymentMethod::Pix->value,
            'status' => PaymentStatus::WaitingPayment->value,
            'amount' => 4900,
            'base_amount' => 4900,
            'fee_amount' => 0,
            'discount_amount' => 0,
            'final_amount' => 4900,
            'currency' => 'BRL',
            'installments' => 1,
            'customer_email' => $customer->email,
        ]);

        app(PaymentService::class)->markPaid($payment, ['id' => 'mp-wins-direto']);

        $this->assertDatabaseHas('service_orders', [
            'id' => $order->getKey(),
            'booster_id' => $booster->getKey(),
            'status' => ServiceOrderStatus::BoosterAssigned->value,
        ]);
        $this->assertDatabaseHas('order_conversations', [
            'service_order_id' => $order->getKey(),
            'booster_id' => $booster->getKey(),
        ]);
        Mail::assertSent(PlainNotificationMail::class, 1);
        Http::assertNothingSent();
    }

    public function test_pending_mercado_pago_payment_is_reconciled_without_webhook(): void
    {
        Mail::fake();
        Http::fake([
            'https://api.mercadopago.com/v1/payments/mp-missed-webhook' => Http::response([
                'id' => 'mp-missed-webhook',
                'status' => 'approved',
                'transaction_amount' => 16.80,
                'date_approved' => now()->toIso8601String(),
            ]),
        ]);
        config([
            'services.mercado_pago.access_token' => 'test-token',
            'notifications.channels.email.enabled' => false,
            'notifications.channels.discord.enabled' => false,
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-reconcile@horizonboost.gg');
        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'wins_by_rank',
            'title' => 'Vitórias Esmeralda I',
            'status' => ServiceOrderStatus::WaitingPayment->value,
            'price' => 16.80,
            'base_price' => 1680,
            'final_price' => 1680,
            'payment_status' => PaymentStatus::WaitingPayment->value,
        ]);
        $payment = Payment::query()->create([
            'user_id' => $customer->getKey(),
            'order_id' => $order->getKey(),
            'boost_id' => $order->getKey(),
            'provider' => PaymentProvider::MercadoPago->value,
            'provider_payment_id' => 'mp-missed-webhook',
            'method' => PaymentMethod::Pix->value,
            'status' => PaymentStatus::WaitingPayment->value,
            'amount' => 1680,
            'base_amount' => 1680,
            'fee_amount' => 0,
            'discount_amount' => 0,
            'final_amount' => 1680,
            'currency' => 'BRL',
            'installments' => 1,
            'customer_email' => $customer->email,
        ]);
        $payment->forceFill(['updated_at' => now()->subMinutes(2)])->saveQuietly();

        $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('data.orders.0.payment_status', PaymentStatus::Paid->value);
        $this->assertSame(PaymentStatus::Paid->value, $payment->refresh()->status);
        $this->assertSame(PaymentStatus::Paid->value, $order->refresh()->payment_status);
        $this->assertSame(ServiceOrderStatus::WaitingBooster->value, $order->status);
    }

    public function test_paid_order_available_and_claimed_order_notifications_are_dispatched(): void
    {
        Mail::fake();
        Http::fake([
            'https://discord.test/orders*' => Http::response(null, 204),
        ]);

        config([
            'notifications.frontend_url' => 'https://app.horizonboost.test',
            'notifications.channels.email.enabled' => true,
            'notifications.channels.discord.enabled' => true,
            'notifications.channels.discord.webhook_url' => 'https://discord.test/orders',
            'notifications.channels.discord.username' => 'Serviços',
            'notifications.channels.discord.avatar_url' => 'https://cdn.discord.test/server-icon.png',
            'notifications.channels.discord.booster_role_id' => '123456789',
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-notify@horizonboost.gg');
        $firstBooster = $this->user(UserRole::Booster, 'booster-one@horizonboost.gg');
        $firstBooster->forceFill(['name' => 'Booster One'])->save();
        $firstBooster->boosterProfile()->create([
            'discord_username' => 'boosterone',
            'discord_user_id' => '222222222222222222',
        ]);
        $secondBooster = $this->user(UserRole::Booster, 'booster-two@horizonboost.gg');

        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Prata para Ouro',
            'status' => ServiceOrderStatus::WaitingPayment->value,
            'price' => 149.90,
            'base_price' => 14990,
            'final_price' => 14990,
            'payment_method' => PaymentMethod::Pix->value,
            'payment_status' => PaymentStatus::WaitingPayment->value,
            'metadata' => [
                'game' => 'lol',
                'current_tier' => 'silver',
                'current_division' => 'II',
                'target_tier' => 'gold',
                'target_division' => 'IV',
                'region' => 'BR',
                'addons' => [
                    'chat_offline' => true,
                    'specific_routes' => ['Mid', 'Support'],
                    'specific_champions' => ['Ahri', 'Lux'],
                    'restricted_hours' => '19h-23h',
                    'priority_service' => true,
                    'favorite_booster' => null,
                ],
                'game_account' => [
                    'email' => 'conta-cliente@example.com',
                    'password_encrypted' => 'secret-password',
                ],
            ],
        ]);

        $payment = Payment::query()->create([
            'user_id' => $customer->getKey(),
            'order_id' => $order->getKey(),
            'boost_id' => $order->getKey(),
            'provider' => PaymentProvider::MercadoPago->value,
            'method' => PaymentMethod::Pix->value,
            'status' => PaymentStatus::WaitingPayment->value,
            'amount' => 14990,
            'base_amount' => 14990,
            'fee_amount' => 0,
            'discount_amount' => 0,
            'final_amount' => 14990,
            'currency' => 'BRL',
            'installments' => 1,
            'customer_email' => $customer->email,
        ]);

        app(PaymentService::class)->markPaid($payment, ['id' => 'mp-notify-1']);

        $this->assertDatabaseHas('service_orders', [
            'id' => $order->getKey(),
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'payment_status' => PaymentStatus::Paid->value,
        ]);

        Mail::assertSentCount(2);
        Http::assertSent(function ($request): bool {
            $payload = $request->data();
            $buttonUrl = (string) data_get($payload, 'components.0.components.0.url');
            $fields = $this->discordFields($payload);
            $encodedPayload = json_encode($payload) ?: '';

            return str_starts_with($request->url(), 'https://discord.test/orders')
                && str_contains($request->url(), 'wait=true')
                && str_contains($request->url(), 'with_components=true')
                && data_get($payload, 'username') === 'Serviços'
                && data_get($payload, 'avatar_url') === 'https://cdn.discord.test/server-icon.png'
                && data_get($payload, 'content') === '<@&123456789>'
                && data_get($payload, 'embeds.0.title') === 'Novo pedido disponível #1'
                && data_get($payload, 'embeds.0.url') === 'https://app.horizonboost.test/booster/orders/1?source=discord'
                && ($fields['Pedido'] ?? null) === '#1'
                && ($fields['Serviço'] ?? null) === 'Boost Solo - Divisão'
                && ($fields['Jogo'] ?? null) === 'League of Legends'
                && ($fields['Fila'] ?? null) === 'Solo/Duo'
                && ($fields['Elo atual'] ?? null) === 'Prata II'
                && ($fields['Elo desejado'] ?? null) === 'Ouro IV'
                && ($fields['Rotas preferidas'] ?? null) === 'Mid, Support'
                && ! array_key_exists('Rota', $fields)
                && ($fields['Região'] ?? null) === 'BR'
                && str_contains((string) ($fields['Valor total'] ?? ''), '149,90')
                && str_contains((string) ($fields['Valor booster'] ?? ''), '89,94')
                && str_contains((string) ($fields['Restrições'] ?? ''), 'Chat offline')
                && str_contains((string) ($fields['Restrições'] ?? ''), 'Campeões específicos: Ahri, Lux')
                && str_contains((string) ($fields['Restrições'] ?? ''), 'Horário disponível: 19h-23h')
                && str_contains((string) ($fields['Restrições'] ?? ''), 'Serviço prioritário')
                && ($fields['Status'] ?? null) === 'Disponível para boosters'
                && ! array_key_exists('Cliente', $fields)
                && ! str_contains($encodedPayload, 'conta-cliente@example.com')
                && ! str_contains($encodedPayload, 'secret-password')
                && ! str_contains($encodedPayload, 'game_account')
                && count(data_get($payload, 'components.0.components', [])) === 1
                && data_get($payload, 'components.0.components.0.label') === 'Pegar serviço'
                && $buttonUrl === 'https://app.horizonboost.test/booster/orders/1?source=discord&action=claim'
                && ! str_contains($buttonUrl, 'token')
                && ! str_contains($buttonUrl, 'jwt')
                && ! str_contains($buttonUrl, 'access');
        });

        $this->withHeader('Authorization', 'Bearer '.$this->token($firstBooster))
            ->postJson('/api/orders/'.$order->getKey().'/claim')
            ->assertOk()
            ->assertJsonPath('data.order.status', ServiceOrderStatus::BoosterAssigned->value)
            ->assertJsonPath('data.order.booster.id', $firstBooster->getKey());

        Mail::assertSentCount(3);
        Http::assertSent(function ($request): bool {
            $payload = $request->data();

            return data_get($payload, 'embeds.0.title') === 'Pedido #1 foi pego'
                && data_get($payload, 'embeds.0.description') === 'Booster One pegou o pedido. Ele não está mais disponível.'
                && data_get($payload, 'content') === null
                && data_get($payload, 'allowed_mentions.users') === []
                && data_get($payload, 'embeds.0.url') === null
                && data_get($payload, 'embeds.0.fields') === []
                && data_get($payload, 'components') === null;
        });

        app(OrderNotificationService::class)->available($order->refresh());

        Http::assertSentCount(2);
        $this->assertSame(ServiceOrderStatus::BoosterAssigned->value, $order->refresh()->status);
        $this->assertSame($firstBooster->getKey(), $order->booster_id);
        $this->assertNotSame($secondBooster->getKey(), $order->booster_id);
    }

    public function test_available_discord_order_uses_restrictions_fallback(): void
    {
        Mail::fake();
        Http::fake([
            'https://discord.test/orders*' => Http::response(null, 204),
        ]);

        config([
            'notifications.frontend_url' => 'https://app.horizonboost.test',
            'notifications.channels.email.enabled' => false,
            'notifications.channels.discord.enabled' => true,
            'notifications.channels.discord.webhook_url' => 'https://discord.test/orders',
            'notifications.channels.discord.booster_role_id' => '123456789',
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-no-restrictions@horizonboost.gg');
        $this->user(UserRole::Booster, 'booster-no-restrictions@horizonboost.gg');
        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Bronze para Prata',
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'price' => 100.00,
            'base_price' => 10000,
            'final_price' => 10000,
            'payment_status' => PaymentStatus::Paid->value,
            'metadata' => [
                'game' => 'lol',
                'current_tier' => 'bronze',
                'current_division' => 'II',
                'target_tier' => 'silver',
                'target_division' => 'IV',
                'addons' => [],
            ],
        ]);

        app(OrderNotificationService::class)->available($order->refresh());
        app(OrderNotificationService::class)->available($order->refresh());

        Http::assertSent(function ($request): bool {
            $payload = $request->data();
            $fields = $this->discordFields($payload);

            return data_get($payload, 'embeds.0.title') === 'Novo pedido disponível #1'
                && ($fields['Elo atual'] ?? null) === 'Bronze II'
                && ($fields['Elo desejado'] ?? null) === 'Prata IV'
                && ($fields['Rotas preferidas'] ?? null) === 'Sem preferência'
                && ! array_key_exists('Rota', $fields)
                && ($fields['Restrições'] ?? null) === 'Nenhuma informada'
                && str_contains((string) ($fields['Valor booster'] ?? ''), '60,00')
                && count(data_get($payload, 'components.0.components', [])) === 1
                && data_get($payload, 'components.0.components.0.label') === 'Pegar serviço';
        });
        Http::assertSentCount(1);
    }

    public function test_game_account_update_and_completion_stay_out_of_discord_channel(): void
    {
        Mail::fake();
        Http::fake([
            'https://discord.test/orders*' => Http::response(null, 204),
        ]);

        config([
            'notifications.frontend_url' => 'https://app.horizonboost.test',
            'notifications.channels.email.enabled' => true,
            'notifications.channels.discord.enabled' => true,
            'notifications.channels.discord.webhook_url' => 'https://discord.test/orders',
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-account@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-account@horizonboost.gg');
        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'booster_id' => $booster->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Ouro para Platina',
            'status' => ServiceOrderStatus::BoosterAssigned->value,
            'price' => 249.90,
            'base_price' => 24990,
            'final_price' => 24990,
            'payment_method' => PaymentMethod::Pix->value,
            'payment_status' => PaymentStatus::Paid->value,
            'metadata' => [
                'current_rank' => 'Ouro IV',
                'desired_rank' => 'Platina IV',
            ],
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($customer))
            ->postJson('/api/orders/'.$order->getKey().'/game-account', [
                'email' => 'riot-account@example.com',
                'password' => 'secret123',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.has_game_account', true);

        Mail::assertSent(PlainNotificationMail::class, function (PlainNotificationMail $mail) use ($booster): bool {
            return $mail->hasTo($booster->email)
                && $mail->subjectLine === 'Dados de conta recebidos no pedido #1';
        });
        Http::assertNothingSent();

        $this->withHeader('Authorization', 'Bearer '.$this->token($booster))
            ->postJson('/api/orders/'.$order->getKey().'/complete')
            ->assertOk()
            ->assertJsonPath('data.order.status', ServiceOrderStatus::Completed->value);

        Mail::assertSent(PlainNotificationMail::class, function (PlainNotificationMail $mail) use ($customer, $booster): bool {
            return $mail->subjectLine === 'Pedido #1 finalizado'
                && ($mail->hasTo($customer->email) || $mail->hasTo($booster->email));
        });
        Mail::assertSentCount(3);
        Http::assertNothingSent();
    }

    public function test_discord_notifications_respect_rate_limit_backoff(): void
    {
        Mail::fake();
        Http::fake([
            'https://discord.test/orders*' => Http::response(['retry_after' => 2], 429, [
                'X-RateLimit-Bucket' => 'orders-bucket',
            ]),
        ]);

        config([
            'notifications.channels.email.enabled' => false,
            'notifications.channels.discord.enabled' => true,
            'notifications.channels.discord.webhook_url' => 'https://discord.test/orders',
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-rate-limit@horizonboost.gg');
        $this->user(UserRole::Booster, 'booster-rate-limit@horizonboost.gg');
        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Bronze para Prata',
            'status' => ServiceOrderStatus::WaitingBooster->value,
            'price' => 149.90,
            'base_price' => 14990,
            'final_price' => 14990,
            'payment_status' => PaymentStatus::Paid->value,
            'metadata' => [
                'current_rank' => 'Bronze IV',
                'desired_rank' => 'Prata IV',
            ],
        ]);

        app(OrderNotificationService::class)->available($order->refresh()->loadMissing('customer'));
        app(OrderNotificationService::class)->available($order->refresh()->loadMissing('customer'));

        Http::assertSentCount(1);
    }

    public function test_paid_order_notification_is_not_duplicated_when_payment_is_already_paid(): void
    {
        Mail::fake();
        Http::fake([
            'https://discord.test/orders*' => Http::response(null, 204),
        ]);

        config([
            'notifications.channels.email.enabled' => true,
            'notifications.channels.discord.enabled' => true,
            'notifications.channels.discord.webhook_url' => 'https://discord.test/orders',
            'notifications.channels.discord.booster_role_id' => '123456789',
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-idempotent@horizonboost.gg');
        $this->user(UserRole::Booster, 'booster-idempotent@horizonboost.gg');
        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'service_type' => 'solo_boost_division',
            'title' => 'Ferro para Bronze',
            'status' => ServiceOrderStatus::WaitingPayment->value,
            'price' => 129.90,
            'base_price' => 12990,
            'final_price' => 12990,
            'payment_method' => PaymentMethod::Pix->value,
            'payment_status' => PaymentStatus::WaitingPayment->value,
            'metadata' => [
                'current_rank' => 'Ferro IV',
                'desired_rank' => 'Bronze IV',
            ],
        ]);

        $payment = Payment::query()->create([
            'user_id' => $customer->getKey(),
            'order_id' => $order->getKey(),
            'boost_id' => $order->getKey(),
            'provider' => PaymentProvider::MercadoPago->value,
            'method' => PaymentMethod::Pix->value,
            'status' => PaymentStatus::WaitingPayment->value,
            'amount' => 12990,
            'base_amount' => 12990,
            'fee_amount' => 0,
            'discount_amount' => 0,
            'final_amount' => 12990,
            'currency' => 'BRL',
            'installments' => 1,
            'customer_email' => $customer->email,
        ]);

        app(PaymentService::class)->markPaid($payment, ['id' => 'mp-idempotent-1']);
        app(PaymentService::class)->markPaid($payment->refresh(), ['id' => 'mp-idempotent-1']);

        $secondPayment = $payment->replicate([
            'provider_payment_id',
            'paid_at',
            'metadata',
        ]);
        $secondPayment->status = PaymentStatus::WaitingPayment->value;
        $secondPayment->save();

        app(PaymentService::class)->markPaid($secondPayment, ['id' => 'mp-idempotent-2']);

        Mail::assertSentCount(1);
        Http::assertSentCount(1);
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

    /**
     * @param array<string,mixed> $payload
     * @return array<string,string>
     */
    private function discordFields(array $payload): array
    {
        $fields = [];

        foreach ((array) data_get($payload, 'embeds.0.fields', []) as $field) {
            if (! is_array($field)) {
                continue;
            }

            $name = (string) ($field['name'] ?? '');
            if ($name !== '') {
                $fields[$name] = (string) ($field['value'] ?? '');
            }
        }

        return $fields;
    }
}
