# Payment Setup

Este projeto usa pagamentos reais com dois provedores:

- Stripe Payment Element para cartao de credito e cartao de debito.
- Mercado Pago Payments API para PIX.

Nao ha QR Code falso, status manual ou preco confiado pelo frontend. O backend recalcula valores, cria o pagamento no provedor, persiste o registro e confirma o resultado por webhook e polling autenticado.

## Variaveis de ambiente

Backend:

```env
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
STRIPE_RESTRICTED_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_REQUIRE_LIVE=true

MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=

PAYMENT_CARD_CREDIT_FEE_PERCENT=
PAYMENT_CARD_DEBIT_FEE_PERCENT=
PAYMENT_PIX_DISCOUNT_PERCENT=10
PAYMENT_MAX_CREDIT_INSTALLMENTS=2
PAYMENT_TEST_MODE=false
PAYMENT_FORCE_NEXT_PIX_AMOUNT_CENTS=

FRONTEND_URL=
BACKEND_URL=
PAYMENT_CA_BUNDLE=
```

Frontend:

```env
VITE_API_URL=https://api.seu-dominio.com/api
```

Em desenvolvimento local, `VITE_API_URL` pode ficar ausente porque o Vite usa proxy para `/api`.

`STRIPE_WEBHOOK_SECRET` precisa ser o segredo do endpoint de webhook, com prefixo `whsec_`. Nao use `sk_test_` aqui.

Em producao, use `sk_live_` no `STRIPE_SECRET_KEY` e `pk_live_` no `STRIPE_PUBLIC_KEY`. O backend valida se as duas chaves pertencem ao mesmo ambiente e bloqueia chaves test quando `STRIPE_REQUIRE_LIVE=true`. `STRIPE_RESTRICTED_KEY` pode guardar a chave `rk_live_` da conta, mas o fluxo atual de PaymentIntent usa `STRIPE_SECRET_KEY`.

Em Windows local, `PAYMENT_CA_BUNDLE` pode apontar para `apps/api/storage/certs/cacert.pem` para evitar erro `cURL error 60` sem desligar validacao TLS.

## Stripe Payment Element

O backend cria um `PaymentIntent` real em `/api/payments/create` para `CREDIT_CARD` e `DEBIT_CARD`, usando:

- `amount` recalculado no servidor.
- `currency=brl`.
- `payment_method_types[]=card`.
- metadata com `paymentId`, `orderId`, `boostId`, `userId`, `method` e `installments`.
- `Idempotency-Key` por pagamento.

O frontend recebe apenas `clientSecret` e `publishableKey`, monta o Stripe Payment Element no modal e confirma com `stripe.confirmPayment({ redirect: "if_required" })`. O pedido so vira `PAID` quando o backend/webhook confirma o status real.

Limitacao: a Stripe nem sempre permite separar perfeitamente cartao de credito e debito antes do processamento no Payment Element. O sistema mantem a escolha visual/comercial e salva `CREDIT_CARD` ou `DEBIT_CARD` internamente, mas o elemento seguro da Stripe processa cartoes via `card`.

## Mercado Pago PIX

O backend cria um pagamento PIX real no Mercado Pago para `PIX`, com:

- `transaction_amount` vindo do pedido real.
- `payment_method_id=pix`.
- `date_of_expiration` fixo em 30 minutos.
- `external_reference` com o ID do payment local.
- `notification_url={BACKEND_URL}/api/payments/mercado-pago/webhook`.
- chave de idempotencia por payment.

O frontend mostra o QR Code e o copia e cola retornados pelo Mercado Pago, e consulta `/api/payments/{paymentId}/status` ate `PAID`, `FAILED` ou `EXPIRED`.

## Webhooks

Stripe:

```text
POST {BACKEND_URL}/api/payments/stripe/webhook
```

Eventos usados:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.processing`
- `payment_intent.requires_action`
- `charge.refunded`

Mercado Pago:

```text
POST {BACKEND_URL}/api/payments/mercado-pago/webhook
```

O webhook do Mercado Pago nao confia apenas no payload. Ele busca o pagamento real na API pelo ID recebido e aplica o status retornado pelo provedor.

## Como testar

Cartao aprovado:

1. Abra o checkout.
2. Escolha cartao de credito ou debito.
3. Use um cartao de teste da Stripe para pagamento aprovado.
4. Confirme no Payment Element.
5. Verifique se o webhook atualiza `payments.status=PAID` e `service_orders.payment_status=PAID`.

3DS/requires action:

1. Use um cartao de teste Stripe que exija autenticacao.
2. Confirme o desafio no modal/fluxo da Stripe.
3. O frontend deve ficar em processamento ate o backend confirmar.

Falha:

1. Use um cartao de teste Stripe recusado.
2. O frontend deve mostrar erro real da Stripe.
3. O webhook deve manter ou atualizar o pagamento como `FAILED`.

PIX:

1. Configure Mercado Pago em sandbox ou producao.
2. Escolha PIX e clique em Gerar PIX.
3. Confira QR Code e copia e cola reais.
4. Pague no ambiente correspondente.
5. O webhook/polling deve atualizar para `PAID`.

Expiracao PIX:

1. Gere um PIX.
2. Aguarde passar `expiresAt`.
3. O polling deve marcar `EXPIRED` se ainda estiver pendente.

Teste PIX de R$ 0,01:

1. Use apenas em ambiente local/teste, nunca com `APP_ENV=production`.
2. Configure `PAYMENT_TEST_MODE=true` e `PAYMENT_FORCE_NEXT_PIX_AMOUNT_CENTS=1`.
3. Gere um PIX real pelo Mercado Pago.
4. Apenas o proximo PIX usa 1 centavo; depois o backend limpa `PAYMENT_FORCE_NEXT_PIX_AMOUNT_CENTS`.

Refund:

1. Reembolse uma cobranca na Stripe.
2. Envie/aguarde `charge.refunded`.
3. O payment e o pedido devem ficar `REFUNDED`.

## Sandbox para producao

Para trocar ambiente:

1. Substitua as chaves test por live no `.env`.
2. Configure `FRONTEND_URL` e `BACKEND_URL` publicos com HTTPS.
3. Recrie os endpoints de webhook em Stripe e Mercado Pago.
4. Atualize `STRIPE_WEBHOOK_SECRET` e `MERCADO_PAGO_WEBHOOK_SECRET`.
5. Rode `php artisan config:clear`.
