import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  ClipboardList,
  Gauge,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Timer,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type { DesktopOrder, LcuSnapshot, LoginPayload, MonitorState, TrackerStatus } from '../shared/types'

const heartbeatSeconds = Number(import.meta.env.VITE_TRACKER_HEARTBEAT_INTERVAL_SECONDS ?? 15)
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://horizonboost.gg/api'

const initialState: MonitorState = {
  session: null,
  isAuthenticated: false,
  leagueClient: 'disconnected',
  activeOrderId: null,
  latestSnapshot: null,
  lastHeartbeatAt: null,
  lastError: null,
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
  const [form, setForm] = useState<LoginPayload>({
    apiBaseUrl,
    email: 'raven.booster@horizonboost.gg',
    password: 'Boost@12345',
  })

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  )

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
  }, [])

  useEffect(() => {
    if (!isTracking || !selectedOrderId) {
      return
    }

    void sendHeartbeat(selectedOrderId)
    const timer = window.setInterval(() => {
      void sendHeartbeat(selectedOrderId)
    }, Math.max(5, heartbeatSeconds) * 1000)

    return () => window.clearInterval(timer)
  }, [isTracking, selectedOrderId])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!window.horizonBoostDesktop) {
      return
    }

    setIsLoggingIn(true)

    try {
      const nextState = await window.horizonBoostDesktop.login(form)
      setState(nextState)
      addLog(`Login autorizado para ${nextState.session?.user?.email ?? form.email}.`)
      await loadOrders()
    } catch (error) {
      addLog(toErrorMessage(error))
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function loadOrders() {
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
      addLog(toErrorMessage(error))
    } finally {
      setIsLoadingOrders(false)
    }
  }

  async function sendHeartbeat(orderId: number) {
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

      addLog(`${statusLabels[snapshot.status]} sincronizado no pedido #${orderId}.`)
    } catch (error) {
      addLog(toErrorMessage(error))
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

  function addLog(message: string) {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    console.info(`[${time}] ${message}`)
  }

  if (!state.isAuthenticated) {
    return (
      <main className="tracker-shell tracker-shell--login">
        <section className="login-card panel">
          <div className="brand-mark">
            <img alt="" src="/horizon-poro-transparent.png" />
          </div>
          <span className="eyebrow">Horizon Boost Tracker</span>
          <h1>Login do booster</h1>
          <p>Entre com sua conta da plataforma para ver os servicos atribuidos.</p>

          <form className="login-form" onSubmit={handleLogin}>
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
            <button className="primary-button" disabled={isLoggingIn} type="submit">
              <ShieldCheck size={18} />
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="tracker-app">
      <aside className="tracker-sidebar panel">
        <div className="brand-row">
          <div className="brand-mark">
            <img alt="" src="/horizon-poro-transparent.png" />
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
            <span>{state.session?.user?.name ?? 'Booster'}</span>
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
                    <small>{order.customer?.name ?? 'Cliente'} · {order.status}</small>
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
        </section>

        </section>
      </div>
    </main>
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
        <strong>{order.customer?.name ?? 'Cliente'}</strong>
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
  const current = readMeta(order, ['current_rank', 'currentRank', 'eloAtual']) ?? 'Ouro IV'
  const desired = readMeta(order, ['desired_rank', 'desiredRank', 'eloDesejado']) ?? 'Platina IV'

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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada.'
}

export default App
