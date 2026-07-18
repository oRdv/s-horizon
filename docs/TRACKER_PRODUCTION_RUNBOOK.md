# Tracker Production Runbook

Este runbook coloca o Horizon Boost Tracker em staging/producao com GitHub Releases, auto-update, notificacoes e rollback.

## Fontes de verdade

- App desktop: `apps/desktop/package.json`
- Backend release resolver: `apps/api/config/tracker.php`
- Workflow de publicacao: `.github/workflows/desktop-release.yml`
- Variaveis por ambiente:
  - `apps/api/.env.example`
  - `apps/api/.env.staging.example`
  - `apps/api/.env.production.example`
  - `apps/desktop/.env.example`
  - `apps/desktop/.env.staging.example`
  - `apps/desktop/.env.production.example`
  - `apps/web/.env.example`
  - `apps/web/.env.staging.example`
  - `apps/web/.env.production.example`

## GitHub Release real

O workflow publica quando uma tag `v*` e enviada ao GitHub. Ele:

1. Le `apps/desktop/package.json`.
2. Falha se a tag nao for `v<version>`.
3. Roda `npm ci`.
4. Roda `npm run lint`.
5. Roda `npm run dist:win`.
6. Verifica os assets com `npm run verify:release-assets`.
7. Cria ou atualiza a GitHub Release.
8. Anexa explicitamente:
   - `release/Horizon-Boost-Tracker-Setup-<version>.exe`
   - `release/Horizon-Boost-Tracker-Setup-<version>.exe.blockmap`
   - `release/latest.yml`

### Publicar pelo fluxo recomendado

```bash
cd /Users/tamiresfer.nandes/Documents/s-horizon
git status --short

cd apps/desktop
npm version 1.0.1 --no-git-tag-version
cd ../..

git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "Release tracker 1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

### Publicar por workflow manual

Use GitHub Actions > Desktop Tracker Release > Run workflow:

```text
tag: v1.0.1
```

O valor precisa bater com `apps/desktop/package.json`.

### Validar release publicada

```bash
gh release view v1.0.1 --repo oRdv/s-horizon
gh release download v1.0.1 --repo oRdv/s-horizon --pattern "Horizon-Boost-Tracker-Setup-1.0.1.exe" --dir /tmp/tracker-release-check
gh release download v1.0.1 --repo oRdv/s-horizon --pattern "Horizon-Boost-Tracker-Setup-1.0.1.exe.blockmap" --dir /tmp/tracker-release-check
gh release download v1.0.1 --repo oRdv/s-horizon --pattern "latest.yml" --dir /tmp/tracker-release-check
```

Se nao houver `gh` autenticado, valide pela UI da GitHub Release.

## Backend lendo GitHub Release

Staging/producao devem usar:

```env
TRACKER_DOWNLOAD_PROVIDER=github
TRACKER_GITHUB_OWNER=oRdv
TRACKER_GITHUB_REPO=s-horizon
TRACKER_GITHUB_RELEASE_TAG=
TRACKER_GITHUB_TOKEN=
TRACKER_WINDOWS_ASSET_REGEX="/^Horizon-Boost-Tracker-Setup-.+\.exe$/i"
```

Para repositorio publico, `TRACKER_GITHUB_TOKEN` pode ficar vazio. Para repositorio privado, configure token de leitura em secret do backend. Nunca coloque token dentro do app desktop.

Validacao:

```bash
curl -H "Authorization: Bearer <BOOSTER_JWT>" \
  "https://api-staging.horizonboost.com.br/api/booster-tracker/release?platform=windows"
```

A resposta deve ter `available=true`, `provider=github`, `version=<release>`, `url=<signed url>` e nao deve expor `direct_url`.

## Provider externo/CDN

Use apenas se GitHub Releases nao atender SLA, CDN ou estrategia de distribuicao:

```env
TRACKER_DOWNLOAD_PROVIDER=generic
TRACKER_GENERIC_RELEASE_BASE_URL=https://cdn.example.com/horizon-tracker
TRACKER_WINDOWS_FILENAME=Horizon-Boost-Tracker-Setup-1.0.1.exe
```

O backend continua entregando link assinado e redirecionando para o asset externo.

## Ambientes e URLs publicas

Local:

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:8000/api
VITE_API_BASE_URL=http://localhost:8000/api
```

Staging:

```env
APP_URL=https://api-staging.horizonboost.com.br
FRONTEND_URL=https://staging.horizonboost.com.br
VITE_API_URL=https://api-staging.horizonboost.com.br/api
VITE_API_BASE_URL=https://api-staging.horizonboost.com.br/api
```

Producao:

```env
APP_URL=https://api.horizonboost.com.br
FRONTEND_URL=https://horizonboost.com.br
VITE_API_URL=https://api.horizonboost.com.br/api
VITE_API_BASE_URL=https://api.horizonboost.com.br/api
```

## SMTP

Configure no backend:

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-password>
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=no-reply@horizonboost.com.br
MAIL_FROM_NAME="Horizon Boost"
NOTIFICATIONS_EMAIL_ENABLED=true
```

Validacao recomendada em staging:

1. Criar pedido pago de teste.
2. Confirmar que boosters ativos recebem e-mail.
3. Confirmar que pedido atribuido envia e-mail ao booster responsavel.
4. Confirmar que envio de dados da conta avisa o booster.
5. Confirmar que pedido finalizado avisa cliente e booster.

## Discord

Crie um canal de oportunidades em staging/producao e gere um webhook:

```env
DISCORD_NOTIFICATIONS_ENABLED=true
DISCORD_ORDERS_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
DISCORD_NOTIFICATIONS_USERNAME="Serviços"
DISCORD_NOTIFICATIONS_AVATAR_URL="https://cdn.discordapp.com/icons/1478058141433200680/213c5b5f64abacfa8dc1ec24676baf27.png?size=256"
DISCORD_BOOSTER_ROLE_ID=<role-id>
DISCORD_NOTIFICATIONS_TIMEOUT_SECONDS=5
```

Como obter `DISCORD_BOOSTER_ROLE_ID`:

1. Ative Developer Mode no Discord.
2. Clique com botao direito no cargo de boosters.
3. Copie o ID.
4. Configure o ID sem `<@&...>`, apenas numeros.

O webhook envia embed com pedido, rota, valor, cliente e link para painel. Quando `DISCORD_BOOSTER_ROLE_ID` existe, o alerta menciona o cargo e `allowed_mentions` restringe mencoes ao cargo configurado.

### Botoes e usuarios reais

As mensagens de pedido disponivel usam um botao de link, nao interacao direta. O Discord apenas abre o site:

- `Pegar serviço`: `/booster/orders/{id}?source=discord&action=claim`

A acao real de aceite acontece no site, depois do login, chamando `POST /api/orders/{id}/claim`. A API valida:

- JWT valido;
- usuario com role `booster`;
- conta ativa;
- pedido ainda sem booster;
- status `PAID` ou `WAITING_BOOSTER`;
- pedido nao reservado para booster favorito;
- lock transacional com `lockForUpdate`;
- auditoria `orders.claimed_by_booster`.

Depois que o aceite e confirmado no site, o backend envia uma unica mensagem simples informando que o pedido foi pego. Atualizacoes de conta e conclusao ficam no e-mail e no painel, sem poluir o canal de oportunidades.

Os eventos `order.available` e `order.claimed` usam uma chave persistente no cache para impedir reenvio do mesmo aviso pelo mesmo webhook. Antes de anunciar disponibilidade, o backend tambem confirma que o pedido continua pago, sem booster e com status `PAID` ou `WAITING_BOOSTER`.

### Limite atual sem bot Discord

Webhook de canal nao autentica quem clicou no botao e nao envia DM individual confiavel. Para aceitar pedido diretamente dentro do Discord ou enviar DM individual, evolua para um bot real com:

```env
DISCORD_BOT_ENABLED=true
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=
DISCORD_GUILD_ID=
DISCORD_OPPORTUNITIES_CHANNEL_ID=
```

O proximo passo seguro e implementar OAuth Discord com escopo `identify`, gravar `discord_user_id` automaticamente e validar interacoes assinadas do Discord antes de qualquer acao.

Falhas:

- `429`: o canal aplica backoff por cache usando `retry_after`/headers.
- `4xx/5xx`: a falha e registrada em log e nao bloqueia e-mail.

## Assinatura Windows

O build local funciona sem certificado. Em CI/producao, configure secrets no GitHub:

```text
WIN_CSC_LINK=<base64 do certificado .pfx/.p12 ou URL segura para o certificado>
WIN_CSC_KEY_PASSWORD=<senha do certificado>
```

Gerar base64 localmente:

```bash
base64 -i certificate.pfx | pbcopy
```

No GitHub:

1. Repository Settings > Secrets and variables > Actions.
2. Crie `WIN_CSC_LINK`.
3. Crie `WIN_CSC_KEY_PASSWORD`.
4. Rode o workflow `Desktop Tracker Release`.

Nao commitar certificado. Nao colocar secrets em `.env`.

## Icone do app

O build gera `apps/desktop/build/icon.ico` automaticamente a partir de `apps/desktop/public/horizon-poro.png` via:

```bash
cd apps/desktop
npm run prebuild
```

Esse arquivo e gerado e ignorado pelo Git. Se o PNG for removido, o build falha cedo com erro claro. Para trocar o icone, substitua `public/horizon-poro.png` por um PNG quadrado de alta resolucao e rode `npm run dist:win`.

## Teste de update 1.0.0 -> 1.0.1

### Simulacao local do feed

Com a versao local ainda em `1.0.0`:

```bash
cd apps/desktop
npm run dist:win
npm run verify:release-assets
npm run stage:update-candidate
npm run serve:update-feed
```

Isso cria:

```text
release/update-sim/1.0.0/
release/update-sim/1.0.1/
dev-app-update.yml
```

Para testar UI de update em desenvolvimento:

```bash
HORIZON_TRACKER_ALLOW_DEV_UPDATES=true \
HORIZON_TRACKER_UPDATE_PROVIDER=generic \
HORIZON_TRACKER_UPDATE_FEED_URL=http://127.0.0.1:8787/update-sim/1.0.1 \
npm run dev
```

Validar:

- `Verificar` muda para update disponivel `1.0.1`.
- `Baixar update` inicia download.
- `latest.yml` aponta para `Horizon-Boost-Tracker-Setup-1.0.1.exe`.
- Se apontar feed para pasta quebrada ou remover o `.exe`, UI entra em erro.
- Se apontar feed para `update-sim/1.0.0`, UI indica sem update.

### Teste real em staging

1. Publique `v1.0.0`.
2. Instale `Horizon-Boost-Tracker-Setup-1.0.0.exe` em uma VM Windows.
3. Publique `v1.0.1`.
4. Abra o app instalado.
5. Clique em `Verificar`.
6. Confirme `1.0.1` disponivel.
7. Clique em `Baixar update`.
8. Confirme progresso e estado `Pronta para instalar`.
9. Clique em `Instalar`.
10. Confirme que o app reinicia e mostra versao `1.0.1`.

## Seguranca

Download:

- `GET /api/booster-tracker/release` exige JWT e role booster.
- URL de download e temporariamente assinada.
- TTL default: `TRACKER_DOWNLOAD_SIGNED_URL_TTL_MINUTES=10`.
- Resposta publica nao expõe `direct_url` nem path local.
- `GET /api/booster-tracker/downloads/{platform}/signed` valida assinatura e usuario booster.

Release privado:

- Se repo for privado, o backend usa `TRACKER_GITHUB_TOKEN`.
- O desktop nao deve receber token GitHub.
- Release asset privado pode ser redirecionado apenas se o asset for publicamente acessivel; para privado com download protegido, prefira provider `generic` com URL assinada/CDN.

Auditoria/logs:

- `tracker.release_viewed`
- `tracker.download_started`
- `tracker.download_unavailable`
- `tracker.heartbeat_started`
- `tracker.status_changed`
- `tracker.match_finished`
- `orders.claimed_by_booster`

Rate limit:

- GitHub release lookup usa cache `TRACKER_RELEASE_CACHE_SECONDS`.
- Discord usa timeout e backoff em `429`.

## Notificacoes

Eventos cobertos:

- Pedido pago e livre: e-mail para boosters ativos e Discord no canal de oportunidades.
- Pedido pego na fila: e-mail para o booster e um aviso simples no Discord.
- Dados da conta atualizados: e-mail para o booster responsavel.
- Pedido finalizado: e-mail para cliente e booster.

Idempotencia:

- `PaymentService::markPaid` usa lock transacional e so notifica quando o pedido muda para pago pela primeira vez.
- O webhook registra os avisos `order.available` e `order.claimed` no cache e ignora repeticoes.

## Rollback

Rollback do desktop:

1. Remova a release quebrada ou marque como draft.
2. Publique uma versao maior corrigida. Exemplo: se `1.0.1` quebrou, publique `1.0.2`; nao reutilize `1.0.1`.
3. Confirme que `latest.yml` aponta para a versao corrigida.
4. Se necessario, configure temporariamente `TRACKER_GITHUB_RELEASE_TAG=v1.0.0` no backend para downloads novos, mas lembre que o auto-updater usa o feed publicado.

Rollback do backend:

1. Desative canais externos se estiverem falhando:

```env
DISCORD_NOTIFICATIONS_ENABLED=false
NOTIFICATIONS_EMAIL_ENABLED=false
```

2. Limpe cache de config:

```bash
php artisan config:clear
php artisan config:cache
```

3. Se GitHub API estiver instavel, mude para provider `generic` apontando CDN estavel.

## Credenciais externas pendentes

Obrigatorias para producao real:

- SMTP host, usuario, senha e remetente validado.
- Discord webhook do canal de oportunidades.
- Discord role ID dos boosters.
- Certificado Windows code signing e senha.
- `TRACKER_GITHUB_TOKEN` somente se o repositorio de release for privado.
- Secrets do banco/Redis/JWT/APP_KEY.

Nao obrigatorias:

- `TRACKER_GENERIC_RELEASE_BASE_URL`, apenas para CDN/storage externo.
- `DISCORD_NOTIFICATIONS_AVATAR_URL`, apenas branding.
