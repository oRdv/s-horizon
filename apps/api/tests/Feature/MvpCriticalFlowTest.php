<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Enums\SecurityTokenPurpose;
use App\Enums\ServiceOrderStatus;
use App\Enums\StaffProfile;
use App\Enums\UserRole;
use App\Models\AccountSecurityToken;
use App\Models\RefreshToken;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MvpCriticalFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_admin_can_list_orders_and_message_completed_order_chat(): void
    {
        $customer = $this->user(UserRole::Customer, 'cliente-chat-admin@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-chat-admin@horizonboost.gg');
        $master = $this->user(UserRole::MasterAdmin, 'master-chat@horizonboost.gg');
        $order = ServiceOrder::query()->create([
            'customer_id' => $customer->getKey(),
            'booster_id' => $booster->getKey(),
            'service_type' => 'solo_boost',
            'title' => 'Pedido concluído',
            'status' => ServiceOrderStatus::Completed->value,
            'payment_status' => PaymentStatus::Paid->value,
            'price' => 100,
            'completed_at' => now(),
        ]);
        $masterToken = $this->loginToken($master);

        $this->withHeader('Authorization', 'Bearer '.$masterToken)
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('data.orders.0.id', $order->getKey())
            ->assertJsonPath('data.orders.0.booster.name', $booster->name);

        $this->withHeader('Authorization', 'Bearer '.$masterToken)
            ->postJson('/api/orders/'.$order->getKey().'/chat/messages', ['body' => 'Mensagem do admin no serviço concluído.'])
            ->assertCreated()
            ->assertJsonPath('data.message.sender_type', 'ADMIN')
            ->assertJsonPath('data.message.sender.name', $master->name);

        $this->withHeader('Authorization', 'Bearer '.$this->loginToken($customer))
            ->postJson('/api/orders/'.$order->getKey().'/chat/messages', ['body' => 'Mensagem tardia do cliente.'])
            ->assertUnprocessable();
    }

    public function test_customer_pix_checkout_webhook_booster_claim_game_account_and_chat_flow(): void
    {
        config([
            'payments.backend_url' => 'https://api.horizonboost.test',
            'services.mercado_pago.access_token' => 'TEST_MP_TOKEN',
            'services.mercado_pago.webhook_secret' => 'mp_test_secret',
        ]);

        Http::fake([
            'https://api.mercadopago.com/v1/payments' => Http::response([
                'id' => 'mp_pix_123',
                'status' => 'pending',
                'point_of_interaction' => [
                    'transaction_data' => [
                        'qr_code' => '000201PIX-COPIA-E-COLA',
                        'qr_code_base64' => 'base64-pix',
                    ],
                ],
            ], 201),
            'https://api.mercadopago.com/v1/payments/mp_pix_123' => Http::response([
                'id' => 'mp_pix_123',
                'status' => 'approved',
                'transaction_amount' => 129.9,
                'external_reference' => '1',
                'date_approved' => now()->toIso8601String(),
            ], 200),
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-pix@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-pix@horizonboost.gg');
        $customerToken = $this->loginToken($customer);
        $boosterToken = $this->loginToken($booster);

        $orderId = $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->postJson('/api/payments/customer', [
                'service_type' => 'duo_boost',
                'title' => 'Duo boost teste',
                'description' => 'Pedido criado pelo teste MVP.',
                'amount' => 12990,
                'metadata' => ['source' => 'mvp_test'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.order.customer_id', $customer->getKey())
            ->json('data.order.id');

        $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->getJson('/api/payments/methods/'.$orderId)
            ->assertOk()
            ->assertJsonPath('data.methods.0.method', PaymentMethod::Pix->value)
            ->assertJsonPath('data.methods.0.available', true);

        $paymentId = $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->postJson('/api/payments/create', [
                'boostId' => $orderId,
                'orderId' => $orderId,
                'method' => PaymentMethod::Pix->value,
            ])
            ->assertCreated()
            ->assertJsonPath('data.provider', PaymentProvider::MercadoPago->value)
            ->assertJsonPath('data.pixCopyPaste', '000201PIX-COPIA-E-COLA')
            ->json('data.payment.id');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => PaymentStatus::WaitingPayment->value,
            'provider_payment_id' => 'mp_pix_123',
        ]);

        $requestId = 'mp-request-1';
        $this->withHeaders([
            'x-request-id' => $requestId,
            'x-signature' => $this->mercadoPagoSignature('mp_pix_123', $requestId, 'mp_test_secret'),
        ])->postJson('/api/payments/mercado-pago/webhook', [
            'type' => 'payment',
            'data' => ['id' => 'mp_pix_123'],
        ])->assertOk()
            ->assertJsonPath('received', true);

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => PaymentStatus::Paid->value,
        ]);
        $this->assertDatabaseHas('service_orders', [
            'id' => $orderId,
            'payment_status' => PaymentStatus::Paid->value,
            'status' => ServiceOrderStatus::WaitingBooster->value,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$boosterToken)
            ->postJson('/api/orders/'.$orderId.'/claim')
            ->assertOk()
            ->assertJsonPath('data.order.status', ServiceOrderStatus::BoosterAssigned->value)
            ->assertJsonPath('data.order.booster.id', $booster->getKey());

        $conversationId = $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->getJson('/api/orders/'.$orderId.'/chat')
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->json('data.conversation.id');

        $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->postJson('/api/orders/'.$orderId.'/chat/messages', [
                'body' => 'Mensagem do cliente com contexto do pedido.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.message.sender_type', 'CLIENT');

        $this->withHeader('Authorization', 'Bearer '.$boosterToken)
            ->postJson('/api/conversations/'.$conversationId.'/messages', [
                'message' => 'Mensagem do booster confirmando recebimento.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.message.sender_type', 'BOOSTER');

        $this->withHeader('Authorization', 'Bearer '.$boosterToken)
            ->postJson('/api/conversations/'.$conversationId.'/messages', [
                'message' => str_repeat('x', 2001),
            ])
            ->assertUnprocessable();

        $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->postJson('/api/orders/'.$orderId.'/game-account', [
                'email' => 'conta-lol@example.com',
                'password' => 'senha-do-jogo',
            ])
            ->assertOk()
            ->assertJsonPath('data.order.has_game_account', true)
            ->assertJsonMissingPath('data.order.metadata.game_account.password_encrypted');

        $metadata = ServiceOrder::query()->findOrFail($orderId)->metadata;
        $this->assertSame('conta-lol@example.com', data_get($metadata, 'game_account.email'));
        $this->assertNotEmpty(data_get($metadata, 'game_account.password_encrypted'));
    }

    public function test_stripe_card_payment_rejects_invalid_webhook_and_marks_paid_with_valid_signature(): void
    {
        config([
            'services.stripe.secret' => 'sk_test_horizon',
            'services.stripe.public' => 'pk_test_horizon',
            'services.stripe.webhook_secret' => 'whsec_horizon',
        ]);

        Http::fake([
            'https://api.stripe.com/v1/payment_intents' => Http::response([
                'id' => 'pi_horizon_123',
                'object' => 'payment_intent',
                'status' => 'requires_payment_method',
                'client_secret' => 'pi_horizon_123_secret_456',
            ], 200),
            'https://api.stripe.com/v1/payment_intents/pi_horizon_123' => Http::response([
                'id' => 'pi_horizon_123',
                'object' => 'payment_intent',
                'status' => 'succeeded',
                'client_secret' => 'pi_horizon_123_secret_456',
                'charges' => ['data' => [['created' => now()->timestamp]]],
            ], 200),
        ]);

        $customer = $this->user(UserRole::Customer, 'cliente-card@horizonboost.gg');
        $token = $this->loginToken($customer);

        $orderId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/payments/customer', [
                'service_type' => 'solo_boost',
                'title' => 'Solo boost cartão',
                'amount' => 15000,
            ])
            ->assertCreated()
            ->json('data.order.id');

        $paymentId = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/payments/create', [
                'boostId' => $orderId,
                'orderId' => $orderId,
                'method' => PaymentMethod::CreditCard->value,
                'installments' => 2,
            ])
            ->assertCreated()
            ->assertJsonPath('data.provider', PaymentProvider::Stripe->value)
            ->assertJsonPath('data.clientSecret', 'pi_horizon_123_secret_456')
            ->json('data.payment.id');

        $payload = json_encode([
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'object' => 'payment_intent',
                    'id' => 'pi_horizon_123',
                    'metadata' => ['paymentId' => (string) $paymentId],
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        $this->call(
            'POST',
            '/api/payments/stripe/webhook',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_STRIPE_SIGNATURE' => 't=1,v1=invalid',
            ],
            $payload,
        )->assertBadRequest();

        $timestamp = (string) time();
        $signature = 't='.$timestamp.',v1='.hash_hmac('sha256', $timestamp.'.'.$payload, 'whsec_horizon');

        $this->call(
            'POST',
            '/api/payments/stripe/webhook',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_STRIPE_SIGNATURE' => $signature,
            ],
            $payload,
        )->assertOk()
            ->assertJsonPath('received', true);

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => PaymentStatus::Paid->value,
            'payment_intent_id' => 'pi_horizon_123',
        ]);
        $this->assertDatabaseHas('service_orders', [
            'id' => $orderId,
            'payment_status' => PaymentStatus::Paid->value,
            'status' => ServiceOrderStatus::WaitingBooster->value,
        ]);
    }

    public function test_password_reset_email_code_changes_password_once_and_revokes_sessions(): void
    {
        $user = $this->user(UserRole::Customer, 'reset@horizonboost.gg', 'OldHorizon123!');
        $this->loginToken($user, 'OldHorizon123!');

        $token = $this->postJson('/api/auth/password/forgot', [
            'email' => $user->email,
        ])->assertOk()
            ->assertJsonPath('data.security.token_sent', true)
            ->json('data.security.dev_token');

        $this->postJson('/api/auth/password/reset', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'NewHorizon123!',
            'password_confirmation' => 'NewHorizon123!',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewHorizon123!', $user->refresh()->password));
        $this->assertTrue(RefreshToken::query()->where('user_id', $user->getKey())->whereNotNull('revoked_at')->exists());

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'OldHorizon123!',
        ])->assertUnauthorized();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'NewHorizon123!',
        ])->assertOk();

        $this->postJson('/api/auth/password/reset', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'AnotherHorizon123!',
            'password_confirmation' => 'AnotherHorizon123!',
        ])->assertUnprocessable();
    }

    public function test_email_verification_code_expires_and_cannot_be_reused(): void
    {
        $user = $this->user(UserRole::Customer, 'verify-once@horizonboost.gg');
        $user->forceFill(['email_verified_at' => null])->save();
        $token = $this->loginToken($user);

        $expiredCode = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/security/email-verification/request')
            ->assertOk()
            ->json('data.security.dev_token');

        AccountSecurityToken::query()
            ->where('email', $user->email)
            ->where('purpose', SecurityTokenPurpose::EmailVerification->value)
            ->latest()
            ->firstOrFail()
            ->forceFill(['expires_at' => now()->subMinute()])
            ->save();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/security/email-verification/confirm', ['token' => $expiredCode])
            ->assertUnprocessable();

        $validCode = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/security/email-verification/request')
            ->assertOk()
            ->json('data.security.dev_token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/security/email-verification/confirm', ['token' => $validCode])
            ->assertOk()
            ->assertJsonPath('data.user.email_verified_at', fn ($value) => filled($value));

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/security/email-verification/confirm', ['token' => $validCode])
            ->assertUnprocessable();
    }

    public function test_role_permissions_protected_routes_and_sensitive_user_fields(): void
    {
        $customer = $this->user(UserRole::Customer, 'cliente-permissao@horizonboost.gg');
        $booster = $this->user(UserRole::Booster, 'booster-permissao@horizonboost.gg');
        $operationsStaff = $this->user(UserRole::Staff, 'staff-operacao@horizonboost.gg');
        $operationsStaff->forceFill(['staff_profile' => StaffProfile::Operations->value])->save();
        $financeStaff = $this->user(UserRole::Staff, 'staff-financeiro@horizonboost.gg');
        $financeStaff->forceFill(['staff_profile' => StaffProfile::Finance->value])->save();
        $master = $this->user(UserRole::MasterAdmin, 'master@horizonboost.gg');

        $customerToken = $this->loginToken($customer);
        $boosterToken = $this->loginToken($booster);
        $operationsToken = $this->loginToken($operationsStaff);
        $financeToken = $this->loginToken($financeStaff);
        $masterToken = $this->loginToken($master);

        $this->getJson('/api/me')->assertUnauthorized();
        $this->withHeader('Authorization', 'Bearer invalid-token')
            ->getJson('/api/me')
            ->assertUnauthorized();

        $profile = $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->getJson('/api/me')
            ->assertOk()
            ->json('data.user');

        $this->assertArrayNotHasKey('password', $profile);
        $this->assertArrayNotHasKey('remember_token', $profile);

        $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->getJson('/api/dashboards/customer')
            ->assertOk();
        $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->getJson('/api/dashboards/master')
            ->assertForbidden();
        $this->withHeader('Authorization', 'Bearer '.$customerToken)
            ->getJson('/api/admin/users')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$boosterToken)
            ->getJson('/api/dashboards/booster')
            ->assertOk();
        $this->withHeader('Authorization', 'Bearer '.$boosterToken)
            ->getJson('/api/admin/users')
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$operationsToken)
            ->getJson('/api/withdrawals')
            ->assertForbidden();
        $this->withHeader('Authorization', 'Bearer '.$financeToken)
            ->getJson('/api/withdrawals')
            ->assertOk();
        $this->withHeader('Authorization', 'Bearer '.$masterToken)
            ->getJson('/api/admin/users')
            ->assertOk();
    }

    private function user(UserRole $role, string $email, string $password = 'Horizon123!'): User
    {
        return User::factory()->create([
            'email' => $email,
            'password' => $password,
            'role' => $role->value,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
    }

    private function loginToken(User $user, string $password = 'Horizon123!'): string
    {
        return (string) $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => $password,
        ])->assertOk()->json('access_token');
    }

    private function mercadoPagoSignature(string $dataId, string $requestId, string $secret): string
    {
        $timestamp = (string) time();
        $manifest = 'id:'.$dataId.';request-id:'.$requestId.';ts:'.$timestamp.';';

        return 'ts='.$timestamp.',v1='.hash_hmac('sha256', $manifest, $secret);
    }
}
