# Horizon Boost Desktop Tracker

App desktop seguro para acompanhar boosts de League of Legends sem interagir com Vanguard, memoria do jogo, automacao, DLL, overlay ou credenciais Riot.

## Variaveis de ambiente

No backend Laravel:

```env
RIOT_API_KEY=
RIOT_REGION=BR1
RIOT_REGIONAL_ROUTE=AMERICAS
TRACKER_HEARTBEAT_INTERVAL_SECONDS=15
TRACKER_ALLOW_LCU=true
TRACKER_REQUIRE_RIOT_ACCOUNT_MATCH=true
```

No app desktop, se precisar apontar um lockfile manualmente:

```env
LEAGUE_LOCKFILE_PATH=C:\Riot Games\League of Legends\lockfile
VITE_TRACKER_HEARTBEAT_INTERVAL_SECONDS=15
```

## Backend

1. Instale dependencias e rode migrations dentro de `apps/api`.
2. Configure `RIOT_API_KEY` com uma chave do Riot Developer Portal.
3. O backend expõe:
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
