# Horizon Boost Desktop Tracker

App desktop seguro para acompanhar boosts de League of Legends sem interagir com Vanguard, memoria do jogo, automacao, DLL, overlay ou credenciais Riot.

Runbook de staging/producao: `docs/TRACKER_PRODUCTION_RUNBOOK.md`.

## Variaveis de ambiente

No backend Laravel:

```env
RIOT_API_KEY=
RIOT_REGION=BR1
RIOT_REGIONAL_ROUTE=AMERICAS
TRACKER_HEARTBEAT_INTERVAL_SECONDS=15
TRACKER_ALLOW_LCU=true
TRACKER_REQUIRE_RIOT_ACCOUNT_MATCH=true
TRACKER_DOWNLOAD_PROVIDER=github
TRACKER_GITHUB_OWNER=oRdv
TRACKER_GITHUB_REPO=s-horizon
TRACKER_GITHUB_RELEASE_TAG=
TRACKER_GENERIC_RELEASE_BASE_URL=
TRACKER_RELEASE_CACHE_SECONDS=300
TRACKER_DOWNLOAD_SIGNED_URL_TTL_MINUTES=10
TRACKER_WINDOWS_ASSET_REGEX=/^Horizon-Boost-Tracker-Setup-.+\.exe$/i

NOTIFICATIONS_EMAIL_ENABLED=true
DISCORD_NOTIFICATIONS_ENABLED=false
DISCORD_ORDERS_WEBHOOK_URL=
DISCORD_BOOSTER_ROLE_ID=
```

No app desktop, se precisar apontar um lockfile manualmente:

```env
LEAGUE_LOCKFILE_PATH=C:\Riot Games\League of Legends\lockfile
VITE_TRACKER_HEARTBEAT_INTERVAL_SECONDS=15
HORIZON_TRACKER_UPDATE_PROVIDER=github
HORIZON_TRACKER_UPDATE_OWNER=oRdv
HORIZON_TRACKER_UPDATE_REPO=s-horizon
```

## Backend

1. Instale dependencias e rode migrations dentro de `apps/api`.
2. Configure `RIOT_API_KEY` com uma chave do Riot Developer Portal.
3. O backend expõe:
   - `GET /api/booster-tracker/release`
   - `GET /api/booster-tracker/downloads/{platform}/signed`
   - `POST /api/booster-tracker/heartbeat`
   - `POST /api/booster-tracker/link-riot-account`
   - `GET /api/booster-tracker/orders/{serviceOrder}/status`
   - `POST /api/booster-tracker/match-finished`
   - `GET /api/admin/boosters/live`
4. O backend nunca confia em `boosterId` enviado pelo desktop. O booster vem do JWT.

## App desktop

Dentro de `apps/desktop`:

```bash
npm install
npm run dev
```

Build de producao Windows:

```bash
npm run dist:win
```

Publicacao em release:

```bash
npm run release:win
```

O build principal usa NSIS e gera os artefatos esperados pelo `electron-updater`, incluindo o instalador `Horizon-Boost-Tracker-Setup-{version}.exe` e o metadata `latest.yml`.
O icone Windows e gerado automaticamente em `apps/desktop/build/icon.ico` a partir de `apps/desktop/public/horizon-poro.png`.

Login de teste existente:

```text
raven.booster@horizonboost.gg
Boost@12345
```

Fluxo:

1. Booster abre o app.
2. Faz login na plataforma.
3. O app lista pedidos atribuídos ao booster.
4. Booster seleciona um pedido e clica em `Iniciar`.
5. O app lê o lockfile do League Client e consulta somente endpoints HTTPS locais do LCU.
6. A cada intervalo, envia heartbeat com status, conta Riot detectada e partida atual.

## Distribuicao e atualizacoes

O canal principal de distribuicao e GitHub Releases. O binario nao deve ser commitado no repositorio nem armazenado em `public/downloads` no servidor de producao.

Decisao tecnica:

- O repositorio guarda apenas codigo, configs e workflow. Instaladores ficam em GitHub Releases.
- A API Laravel consulta a API do GitHub, filtra o asset do Windows e gera um link temporario assinado para o booster autenticado.
- O desktop instalado usa `electron-updater` e o metadata `latest.yml` publicado pelo `electron-builder`.
- Se o instalador crescer acima do ideal para GitHub Releases ou exigir SLA/CDN, o mesmo contrato permanece: use `TRACKER_DOWNLOAD_PROVIDER=generic`, publique em S3/CloudFront/R2 ou CDN equivalente, configure `TRACKER_GENERIC_RELEASE_BASE_URL` e ajuste `publish.provider` do electron-builder para `generic`.

Fluxo automatizado:

1. Atualize `apps/desktop/package.json` e `TRACKER_APP_VERSION`.
2. Crie uma tag no formato `v1.0.1` com a mesma versao do package.
3. Push da tag dispara `.github/workflows/desktop-release.yml`.
4. O workflow roda `npm ci`, `npm run lint`, builda o app, valida assets e publica no GitHub Release via `GH_TOKEN`.
5. O release precisa conter:
   - `Horizon-Boost-Tracker-Setup-{version}.exe`
   - `latest.yml`
   - `Horizon-Boost-Tracker-Setup-{version}.exe.blockmap`

Fluxo manual equivalente:

1. Atualize `apps/desktop/package.json` com a nova versao.
2. Rode `npm run dist:win` em `apps/desktop`.
3. Publique no GitHub Release os arquivos gerados pelo electron-builder, incluindo:
   - `Horizon-Boost-Tracker-Setup-{version}.exe`
   - `latest.yml`
   - blocos/arquivos auxiliares gerados pelo builder, quando existirem.
4. A API consulta o ultimo release do GitHub, encontra o asset do Windows pelo regex configurado e retorna um link assinado temporario para o booster autenticado.
5. O download assinado redireciona para o asset do GitHub, evitando depender de arquivo local no backend.
6. O app instalado consulta o feed do `electron-updater`; quando houver versao nova, o booster pode baixar e instalar pelo painel de atualizacoes do proprio Tracker.

Para releases privados, configure `TRACKER_GITHUB_TOKEN` no backend e `GH_TOKEN` no pipeline de build/publicacao. Para volumes maiores ou necessidade de SLA/CDN, mantenha a mesma camada de metadados da API e troque o provider do electron-builder para S3/CDN/generic.

Pendente para producao: assinar o executavel Windows com certificado de code signing (`WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`) para reduzir alertas do Windows SmartScreen.

## Notificacoes de pedidos

A API possui um dispatcher central em `App\Services\Notifications` com canais de e-mail e Discord. Novos canais, como push ou notificacoes dentro do desktop, devem implementar `NotificationChannel` sem duplicar regras de pedido.

Eventos integrados:

- pagamento confirmado e pedido livre: notifica boosters ativos por e-mail e Discord;
- pedido pego: notifica o booster por e-mail e publica uma confirmacao simples no Discord;
- dados da conta do jogo atualizados: notifica o booster por e-mail;
- pedido finalizado: notifica cliente e booster por e-mail.

O Discord usa webhook de canal para dois alertas por pedido: disponibilidade com o botao `Pegar serviço` e confirmacao de que o pedido foi pego. O aceite real acontece no site autenticado. Para interacoes executadas diretamente dentro do Discord, a proxima etapa deve adicionar um bot com comandos/interactions e permissoes por cargo.

O canal Discord respeita respostas `429` usando `retry_after`/headers de rate limit, ativa backoff e registra cada aviso no cache para evitar duplicacao.

Modelo recomendado para a proxima evolucao do Discord:

- canal de oportunidades com embed do pedido, valor, rota e prazo;
- mencao opcional ao cargo de boosters;
- bot com slash commands e botoes para `ver detalhes` e `aceitar pedido`;
- respostas efemeras para falhas de permissao ou pedido ja pego;
- fila interna/queue worker para envio em lote e retry controlado.

## LCU

O LCU e consultado apenas localmente em `127.0.0.1` usando as credenciais temporarias do lockfile do League Client.

Endpoints usados:

- `/lol-summoner/v1/current-summoner`
- `/lol-gameflow/v1/session`
- `/lol-champ-select/v1/session`

Essas leituras nao acessam memoria, nao modificam arquivos do jogo, nao automatizam input e nao interagem com Vanguard.

## Riot Match API

Quando houver `matchId`, o backend tenta validar a partida por:

```text
https://{regional_route}.api.riotgames.com/lol/match/v5/matches/{matchId}
```

Se a chave Riot nao estiver configurada, o backend ainda aceita o registro local do desktop para ambiente de desenvolvimento, mantendo `raw_data` salvo quando enviado.

## Areas web

- Cliente: pedidos mostram o status do acompanhamento quando houver heartbeat.
- Master admin: dashboard mostra boosters ao vivo, conta Riot, pedido e ultimo sinal.
- Booster: o app desktop usa a mesma atribuicao de pedidos ja existente.

## Cuidados com Vanguard

Este tracker nao deve:

- ler memoria do jogo;
- injetar DLL;
- manipular `League of Legends.exe`;
- criar overlay dentro do jogo;
- simular teclado ou mouse;
- pedir senha Riot;
- tentar ocultar processo;
- rodar como kernel/admin sem necessidade;
- burlar rate limit da Riot.

O app foi desenhado para funcionar por consentimento do booster e por APIs locais/publicas permitidas.
