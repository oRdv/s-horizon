import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  CloudDownload,
  ClipboardList,
  Gauge,
  LogOut,
  PackageCheck,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Timer,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type { DesktopOrder, LcuSnapshot, LoginPayload, MonitorState, TrackerStatus, UpdateState } from '../shared/types'

const heartbeatSeconds = Number(import.meta.env.VITE_TRACKER_HEARTBEAT_INTERVAL_SECONDS ?? 15)
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://api.horizonboost.com.br/api'

const initialState: MonitorState = {
  session: null,
  isAuthenticated: false,
  leagueClient: 'disconnected',
  activeOrderId: null,
  latestSnapshot: null,
  lastHeartbeatAt: null,
  lastError: null,
  updates: {
    status: 'idle',
    currentVersion: '0.0.0',
    availableVersion: null,
    progress: null,
    downloaded: false,
    lastCheckedAt: null,
    error: null,
  },
}

const statusLabels: Record<TrackerStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  CLIENT_OPEN: 'Client aberto',
  IN_LOBBY: 'Em lobby',
  IN_CHAMP_SELECT: 'Selecao de campeoes',
  IN_GAME: 'Em partida',
  GAME_ENDED: 'Partida finalizada',
}

function App() {
  const [state, setState] = useState<MonitorState>(initialState)
  const [orders, setOrders] = useState<DesktopOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [authFeedback, setAuthFeedback] = useState<string | null>(null)
  const [activityLog, setActivityLog] = useState<string[]>([])
  const latestSnapshotByOrderRef = useRef<Record<number, LcuSnapshot | null>>({})
  const reportedMatchKeysRef = useRef<Set<string>>(new Set())
  const [form, setForm] = useState<LoginPayload>({
    apiBaseUrl,
    email: '',
    password: '',
    twoFactorCode: '',
  })

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  )

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setActivityLog((current) => [`[${time}] ${message}`, ...current].slice(0, 8))
    console.info(`[${time}] ${message}`)
  }, [])

  const loadOrders = useCallback(async () => {
    if (!window.horizonBoostDesktop) {
      return
    }

    setIsLoadingOrders(true)

    try {
      const nextOrders = await window.horizonBoostDesktop.getOrders()
      setOrders(nextOrders)
      setSelectedOrderId((current) => current ?? nextOrders[0]?.id ?? null)
      addLog(`${nextOrders.length} pedido(s) atribuido(s) carregado(s).`)
    } catch (error) {
      const message = toErrorMessage(error)
      addLog(message)
      setState((current) => ({ ...current, lastError: message }))
    } finally {
      setIsLoadingOrders(false)
    }
  }, [addLog])

  const maybeReportMatchFinished = useCallback(async (orderId: number, snapshot: LcuSnapshot) => {
    if (!window.horizonBoostDesktop || snapshot.status !== 'GAME_ENDED') {
      return
    }

    const previousSnapshot = latestSnapshotByOrderRef.current[orderId]
    const previousGame = previousSnapshot?.currentGame
    const currentGame = snapshot.currentGame ?? previousGame
    const wasInGame = previousSnapshot?.status === 'IN_GAME'

    if (!currentGame || (!wasInGame && !currentGame.gameId)) {
      return
    }

    const matchKey = `${orderId}:${currentGame.gameId ?? currentGame.startedAt ?? snapshot.capturedAt}`

    if (reportedMatchKeysRef.current.has(matchKey)) {
      return
    }

    reportedMatchKeysRef.current.add(matchKey)

    await window.horizonBoostDesktop.matchFinished({
      orderId,
      gameId: currentGame.gameId,
      riotPuuid: snapshot.riotAccount?.puuid ?? previousSnapshot?.riotAccount?.puuid,
      championId: currentGame.championId,
      queueId: currentGame.queueId,
      result: 'UNKNOWN',
      startedAt: currentGame.startedAt ?? previousGame?.startedAt,
      endedAt: snapshot.capturedAt,
      rawData: {
        source: 'desktop-lcu',
        gameflowPhase: snapshot.gameflowPhase,
        capturedAt: snapshot.capturedAt,
      },
    })

    addLog(`Partida finalizada registrada no pedido #${orderId}.`)
  }, [addLog])

  const sendHeartbeat = useCallback(async (orderId: number) => {
    if (!window.horizonBoostDesktop) {
      return
    }

    try {
      const snapshot = await window.horizonBoostDesktop.lcuSnapshot()

      await window.horizonBoostDesktop.heartbeat({
        orderId,
        status: snapshot.status,
        riotAccount: snapshot.riotAccount,
        currentGame: snapshot.currentGame,
        rankedProgress: snapshot.rankedProgress,
      })

      await maybeReportMatchFinished(orderId, snapshot)
      latestSnapshotByOrderRef.current[orderId] = snapshot

      addLog(`${statusLabels[snapshot.status]} sincronizado no pedido #${orderId}.`)
    } catch (error) {
      const message = toErrorMessage(error)
      addLog(message)
      setState((current) => ({ ...current, lastError: message }))
    }
  }, [addLog, maybeReportMatchFinished])

  useEffect(() => {
    if (!window.horizonBoostDesktop) {
      return
    }

    let active = true

    void window.horizonBoostDesktop.bootstrap().then((bootstrapState) => {
      if (!active) return
      setState(bootstrapState)
      if (bootstrapState.isAuthenticated) {
        void loadOrders()
      }
    })

    const unsubscribe = window.horizonBoostDesktop.onStateChange((nextState) => {
      if (!active) return
      setState(nextState)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [loadOrders])

  useEffect(() => {
    if (!isTracking || !selectedOrderId) {
      return
    }

    const initialTimer = window.setTimeout(() => {
      void sendHeartbeat(selectedOrderId)
    }, 0)
    const timer = window.setInterval(() => {
      void sendHeartbeat(selectedOrderId)
    }, Math.max(5, heartbeatSeconds) * 1000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [isTracking, selectedOrderId, sendHeartbeat])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!window.horizonBoostDesktop) {
      return
    }

    setIsLoggingIn(true)
    setAuthFeedback(null)

    try {
      const nextState = await window.horizonBoostDesktop.login(form)
      setState(nextState)
      addLog(`Login autorizado para ${nextState.session?.user?.email ?? form.email}.`)
      await loadOrders()
    } catch (error) {
      const message = toErrorMessage(error)
      setAuthFeedback(message)
      addLog(message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    if (!window.horizonBoostDesktop) {
      return
    }

    setIsTracking(false)
    setOrders([])
    setSelectedOrderId(null)
    setState(await window.horizonBoostDesktop.logout())
  }

  async function handleCheckForUpdates() {
    if (!window.horizonBoostDesktop) {
      return
    }

    try {
      const updates = await window.horizonBoostDesktop.checkForUpdates()
      setState((current) => ({ ...current, updates }))
      addLog(updateLogMessage(updates))
    } catch (error) {
      const message = toErrorMessage(error)
      addLog(message)
      setState((current) => ({
        ...current,
        updates: { ...current.updates, status: 'error', error: message },
      }))
    }
  }

  async function handleDownloadUpdate() {
    if (!window.horizonBoostDesktop) {
      return
    }

    try {
      const updates = await window.horizonBoostDesktop.downloadUpdate()
      setState((current) => ({ ...current, updates }))
      addLog('Download da atualizacao iniciado.')
    } catch (error) {
      const message = toErrorMessage(error)
      addLog(message)
      setState((current) => ({
        ...current,
        updates: { ...current.updates, status: 'error', error: message },
      }))
    }
  }

  async function handleInstallUpdate() {
    if (!window.horizonBoostDesktop) {
      return
    }

    try {
      await window.horizonBoostDesktop.installUpdate()
      addLog('Instalando atualizacao e reiniciando o Tracker.')
    } catch (error) {
      const message = toErrorMessage(error)
      addLog(message)
      setState((current) => ({
        ...current,
        updates: { ...current.updates, status: 'error', error: message },
      }))
    }
  }

  if (!state.isAuthenticated) {
    return (
      <main className="tracker-shell tracker-shell--login">
        <section className="login-card panel">
          <div className="brand-mark">
            <img alt="" src="./horizon-poro-transparent.png" />
          </div>
          <span className="eyebrow">Horizon Boost Tracker</span>
          <h1>Login do booster</h1>
          <p>Entre com sua conta da plataforma para ver os servicos atribuidos.</p>

          <form className="login-form" onSubmit={handleLogin}>
            <details className="advanced-settings">
              <summary>Servidor da plataforma</summary>
              <label className="field">
                <span>URL da API</span>
                <input
                  onChange={(event) => setForm((current) => ({ ...current, apiBaseUrl: event.target.value }))}
                  value={form.apiBaseUrl}
                />
              </label>
              <small>Mantenha o padrao. Altere apenas se o suporte orientar.</small>
            </details>
            <label className="field">
              <span>Email</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                value={form.email}
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                value={form.password}
              />
            </label>
            <label className="field">
              <span>Codigo 2FA</span>
              <input
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  twoFactorCode: event.target.value.replace(/\D/g, '').slice(0, 6),
                }))}
                placeholder="Se solicitado"
                value={form.twoFactorCode ?? ''}
              />
            </label>
            <button className="primary-button" disabled={isLoggingIn} type="submit">
              <ShieldCheck size={18} />
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          {authFeedback ? (
            <div className="tracker-alert" role="alert">
              {authFeedback}
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  return (
    <main className="tracker-app">
      <aside className="tracker-sidebar panel">
        <div className="brand-row">
          <div className="brand-mark">
            <img alt="" src="./horizon-poro-transparent.png" />
          </div>
          <div>
            <span className="eyebrow">Tracker</span>
            <strong>Horizon Boost</strong>
          </div>
        </div>

        <nav className="tracker-sidebar__nav" aria-label="Menu do tracker">
          <a href="#pedidos" className="tracker-sidebar__link is-active">
            <ClipboardList size={18} />
            Pedidos
          </a>
          <a href="#sessao" className="tracker-sidebar__link">
            <Gauge size={18} />
            Sessao
          </a>
        </nav>

        <div className="tracker-sidebar__footer">
          <div>
            <span>{state.session?.user?.name ?? 'Nome nao informado'}</span>
            <strong>{state.session?.user?.email}</strong>
          </div>
          <button className="icon-button" onClick={handleLogout} title="Sair" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="tracker-shell">
        <section className="hero-panel panel">
          <div>
            <span className="eyebrow">Acompanhamento seguro</span>
            <h1>Tracking de boost em tempo real</h1>
            <p>Pedidos atribuidos, conta Riot detectada pelo LCU e heartbeat do status atual.</p>
          </div>
          <div className="hero-panel__status">
            <span>{formatRiotAccount(state.latestSnapshot)}</span>
          </div>
        </section>

        {state.lastError ? (
          <div className="tracker-alert" role="alert">
            {state.lastError}
          </div>
        ) : null}

        <section className="tracker-grid">
        <section className="panel orders-panel" id="pedidos">
          <div className="section-header">
            <div>
              <span className="eyebrow">Meus servicos</span>
              <h2>Pedidos atribuidos</h2>
            </div>
            <button className="ghost-button" disabled={isLoadingOrders} onClick={() => void loadOrders()} type="button">
              <RefreshCw size={17} />
              Atualizar
            </button>
          </div>

          <div className="order-list">
            {orders.length === 0 ? (
              <div className="empty-state">Nenhum pedido atribuido para este booster.</div>
            ) : (
              orders.map((order) => (
                <button
                  className={`order-card ${selectedOrderId === order.id ? 'order-card--active' : ''}`}
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  type="button"
                >
                  <div className="order-card__main">
                    <span>Pedido #{order.id}</span>
                    <strong>{formatOrderTitle(order)}</strong>
                    <small>{order.customer?.name ?? 'Cliente sem nome'} · {order.status}</small>
                  </div>
                  <RankRoute order={order} />
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel active-panel" id="sessao">
          <div className="section-header">
            <div>
              <span className="eyebrow">Sessao ativa</span>
              <h2>{selectedOrder ? `Pedido #${selectedOrder.id}` : 'Selecione um pedido'}</h2>
            </div>
            <button
              className={isTracking ? 'danger-button' : 'primary-button'}
              disabled={!selectedOrder}
              onClick={() => setIsTracking((current) => !current)}
              type="button"
            >
              {isTracking ? <Square size={17} /> : <Play size={17} />}
              {isTracking ? 'Parar' : 'Iniciar'}
            </button>
          </div>

          <div className="signal-grid">
            <Signal icon={state.leagueClient === 'connected' ? Wifi : WifiOff} label="League Client" value={state.leagueClient === 'connected' ? 'Aberto' : 'Fechado'} />
            <Signal icon={Activity} label="Status" value={statusLabels[state.latestSnapshot?.status ?? 'OFFLINE']} />
            <Signal icon={UserRound} label="Conta Riot" value={formatRiotAccount(state.latestSnapshot)} />
            <Signal icon={Timer} label="Gameflow" value={state.latestSnapshot?.gameflowPhase ?? 'Aguardando'} />
          </div>

          <ProgressPanel order={selectedOrder} snapshot={state.latestSnapshot} />
          {selectedOrder ? <OrderSummary order={selectedOrder} /> : null}
          <UpdatePanel
            onCheck={() => void handleCheckForUpdates()}
            onDownload={() => void handleDownloadUpdate()}
            onInstall={() => void handleInstallUpdate()}
            updates={state.updates}
          />
          <ActivityPanel items={activityLog} />
        </section>

        </section>
      </div>
    </main>
  )
}

function UpdatePanel({
  onCheck,
  onDownload,
  onInstall,
  updates,
}: {
  onCheck: () => void
  onDownload: () => void
  onInstall: () => void
  updates: UpdateState
}) {
  const isChecking = updates.status === 'checking'
  const isDownloading = updates.status === 'downloading'
  const isInstalling = updates.status === 'installing'
  const canDownload = updates.status === 'available'
  const canInstall = updates.status === 'downloaded' || updates.downloaded

  return (
    <div className="update-panel">
      <div className="update-panel__header">
        <div>
          <span>Atualizacoes</span>
          <strong>{updateStatusLabel(updates)}</strong>
        </div>
        <PackageCheck size={21} />
      </div>

      <div className="update-panel__meta">
        <span>Instalada: {updates.currentVersion}</span>
        <span>Disponivel: {updates.availableVersion ?? 'Nenhuma'}</span>
      </div>

      {isDownloading ? (
        <div className="progress-track update-panel__progress" aria-label="Progresso do download da atualizacao">
          <span style={{ width: `${Math.max(0, Math.min(100, updates.progress ?? 0))}%` }} />
        </div>
      ) : null}

      {updates.error ? (
        <p className="update-panel__error">{updates.error}</p>
      ) : null}

      <div className="update-panel__actions">
        <button className="ghost-button" disabled={isChecking || isDownloading || isInstalling} onClick={onCheck} type="button">
          <RefreshCw className={isChecking ? 'spin-icon' : undefined} size={16} />
          Verificar
        </button>
        <button className="ghost-button" disabled={!canDownload || isDownloading || isInstalling} onClick={onDownload} type="button">
          <CloudDownload className={isDownloading ? 'spin-icon' : undefined} size={16} />
          Baixar update
        </button>
        <button className="primary-button" disabled={!canInstall || isInstalling} onClick={onInstall} type="button">
          <PackageCheck size={16} />
          Instalar
        </button>
      </div>
    </div>
  )
}

function ActivityPanel({ items }: { items: string[] }) {
  return (
    <div className="activity-panel">
      <div className="activity-panel__header">
        <span>Eventos recentes</span>
        <strong>{items.length}</strong>
      </div>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>Nenhum evento registrado nesta sessao.</p>
      )}
    </div>
  )
}

function Signal({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="signal-card">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ProgressPanel({ order, snapshot }: { order: DesktopOrder | null; snapshot: LcuSnapshot | null }) {
  const ranked = snapshot?.rankedProgress
  const progress = calculateProgressPercent(order, ranked)
  const label = ranked?.tier && ranked?.division
    ? `${rankName(ranked.tier)} ${ranked.division} - ${ranked.leaguePoints ?? 0} PDL`
    : 'Aguardando ranked'

  return (
    <div className="progress-panel">
      <div className="progress-panel__top">
        <div>
          <span>Progresso da conta</span>
          <strong>{label}</strong>
        </div>
        <b>{Math.round(progress)}%</b>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>{progress >= 90 ? 'Perto de finalizar' : 'Atualiza quando o League Client expõe o PDL pelo LCU'}</small>
    </div>
  )
}

function OrderSummary({ order }: { order: DesktopOrder }) {
  return (
    <div className="order-summary">
      <div>
        <span>Servico</span>
        <strong>{order.title}</strong>
      </div>
      <div>
        <span>Cliente</span>
        <strong>{order.customer?.name ?? 'Cliente sem nome'}</strong>
      </div>
      <div>
        <span>Status do pedido</span>
        <strong>{order.status}</strong>
      </div>
      <RankRoute order={order} large />
    </div>
  )
}

function RankRoute({ order, large = false }: { order: DesktopOrder; large?: boolean }) {
  const current = readMeta(order, ['current_rank', 'currentRank', 'eloAtual']) ?? 'Nao informado'
  const desired = readMeta(order, ['desired_rank', 'desiredRank', 'eloDesejado']) ?? 'Nao informado'

  return (
    <div className={`rank-route ${large ? 'rank-route--large' : ''}`}>
      <RankIcon label={current} />
      <span>{current}</span>
      <i>para</i>
      <RankIcon label={desired} />
      <span>{desired}</span>
    </div>
  )
}

function RankIcon({ label }: { label: string }) {
  const key = label.toLowerCase().split(' ')[0]

  return <span className={`rank-icon rank-icon--${key}`}>{key.slice(0, 2).toUpperCase()}</span>
}

function calculateProgressPercent(order: DesktopOrder | null, ranked?: LcuSnapshot['rankedProgress']) {
  if (!order || !ranked) return 0

  const start = rankScore(readMeta(order, ['current_tier', 'current_rank', 'currentRank']), readMeta(order, ['current_division']), 0)
  const target = rankScore(readMeta(order, ['target_tier', 'desired_rank', 'desiredRank']), readMeta(order, ['target_division']), 100)
  const current = rankScore(ranked.tier, ranked.division, ranked.leaguePoints ?? 0)

  if (target <= start) return 0

  return Math.max(0, Math.min(100, ((current - start) / (target - start)) * 100))
}

function rankScore(tier?: string | null, division?: string | null, lp = 0) {
  const tiers: Record<string, number> = {
    iron: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    emerald: 5,
    diamond: 6,
    master: 7,
    grandmaster: 8,
    challenger: 9,
  }
  const divisions: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 }

  return ((tiers[String(tier ?? '').toLowerCase()] ?? 0) * 400)
    + ((divisions[String(division ?? '').toUpperCase()] ?? 0) * 100)
    + Math.max(0, Math.min(100, Number(lp)))
}

function rankName(tier?: string | null) {
  const labels: Record<string, string> = {
    iron: 'Ferro',
    bronze: 'Bronze',
    silver: 'Prata',
    gold: 'Ouro',
    platinum: 'Platina',
    emerald: 'Esmeralda',
    diamond: 'Diamante',
    master: 'Mestre',
    grandmaster: 'Grao-mestre',
    challenger: 'Desafiante',
  }

  return labels[String(tier ?? '').toLowerCase()] ?? tier ?? 'Elo'
}

function formatOrderTitle(order: DesktopOrder) {
  const current = readMeta(order, ['current_rank', 'currentRank'])
  const desired = readMeta(order, ['desired_rank', 'desiredRank'])

  return current && desired ? `${current} -> ${desired}` : order.title
}

function readMeta(order: DesktopOrder, keys: string[]) {
  for (const key of keys) {
    const value = order.metadata?.[key]

    if (typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }

  return null
}

function formatRiotAccount(snapshot: LcuSnapshot | null) {
  const riot = snapshot?.riotAccount

  if (!riot) {
    return 'Nao detectada'
  }

  return riot.tagLine ? `${riot.gameName ?? riot.summonerName}#${riot.tagLine}` : riot.summonerName ?? 'Detectada'
}

function updateStatusLabel(updates: UpdateState) {
  const labels: Record<UpdateState['status'], string> = {
    idle: 'Aguardando verificacao',
    checking: 'Verificando release',
    available: `Versao ${updates.availableVersion ?? 'nova'} disponivel`,
    'not-available': 'Voce esta na versao mais recente',
    downloading: `Baixando ${Math.round(updates.progress ?? 0)}%`,
    downloaded: 'Pronta para instalar',
    installing: 'Reiniciando para instalar',
    error: 'Verificacao indisponivel',
  }

  return labels[updates.status]
}

function updateLogMessage(updates: UpdateState) {
  if (updates.status === 'available') {
    return `Atualizacao ${updates.availableVersion ?? ''} disponivel.`
  }

  if (updates.status === 'not-available') {
    return 'Nenhuma atualizacao disponivel.'
  }

  if (updates.status === 'error' && updates.error) {
    return updates.error
  }

  return 'Verificacao de atualizacao executada.'
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada.'
}

export default App
