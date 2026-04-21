import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Radar,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'

import { SessionForm } from './components/SessionForm'
import { SignalCard } from './components/SignalCard'
import { StatePill } from './components/StatePill'
import type { DesktopSession, MonitorState } from '../shared/types'

const initialState: MonitorState = {
  session: null,
  isAuthenticated: false,
  leagueClient: 'disconnected',
  currentMatch: {
    active: false,
    gameTimeSeconds: 0,
    gameMode: null,
    mapName: null,
    startedAt: null,
    externalMatchId: null,
  },
  lastReport: null,
  lastError: null,
}

function App() {
  const [monitorState, setMonitorState] = useState<MonitorState>(initialState)
  const [apiBaseUrl, setApiBaseUrl] = useState('http://127.0.0.1:8000')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function hydrateFormFromState(state: MonitorState) {
    if (state.session?.apiBaseUrl) {
      setApiBaseUrl((currentValue) => currentValue || state.session?.apiBaseUrl || '')
    }
  }

  useEffect(() => {
    if (!window.horizonBoostDesktop) {
      return
    }

    let active = true

    async function bootstrap() {
      const state = await window.horizonBoostDesktop?.bootstrap()

      if (!active || !state) {
        return
      }

      hydrateFormFromState(state)
      setMonitorState(state)
    }

    void bootstrap()

    const unsubscribe = window.horizonBoostDesktop.onStateChange((nextState) => {
      if (!active) {
        return
      }

      hydrateFormFromState(nextState)
      setMonitorState(nextState)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const connectionLabel = useMemo(() => {
    switch (monitorState.leagueClient) {
      case 'in_match':
        return 'Em partida'
      case 'lcu_ready':
        return 'LCU conectado'
      default:
        return 'Client desconectado'
    }
  }, [monitorState.leagueClient])

  const sessionTone = monitorState.isAuthenticated ? 'positive' : 'danger'
  const clientTone =
    monitorState.leagueClient === 'in_match'
      ? 'positive'
      : monitorState.leagueClient === 'lcu_ready'
        ? 'neutral'
        : 'danger'

  async function handleSaveSession(session: DesktopSession) {
    if (!window.horizonBoostDesktop) {
      return
    }

    setIsSaving(true)

    try {
      const nextState = await window.horizonBoostDesktop.saveSession(session)
      hydrateFormFromState(nextState)
      setMonitorState(nextState)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearSession() {
    if (!window.horizonBoostDesktop) {
      return
    }

    const nextState = await window.horizonBoostDesktop.clearSession()
    setAccessToken('')
    setRefreshToken('')
    hydrateFormFromState(nextState)
    setMonitorState(nextState)
  }

  return (
    <div className="desktop-shell">
      <header className="desktop-shell__header">
        <div className="brand-row">
          <div className="brand-row__icon">
            <img alt="" aria-hidden="true" src="/horizon-poro-transparent.png" />
          </div>

          <div>
            <span className="eyebrow">Desktop Monitor</span>
            <h1>Horizon Boost</h1>
          </div>
        </div>
      </header>

      <section className="hero-panel panel">
        <div className="hero-panel__copy">
          <span className="eyebrow">Monitor local do League</span>
          <h2>
            Sessão por token com integração somente por endpoints locais do client.
          </h2>
          <p>
            O app detecta partidas pelo LCU / liveclientdata e envia resultados ao
            backend sem acessar memória.
          </p>
        </div>

        <div className="hero-panel__signals">
          <StatePill label={monitorState.isAuthenticated ? 'Backend ativo' : 'Sem sessão'} tone={sessionTone} />
          <StatePill label={connectionLabel} tone={clientTone} />
        </div>
      </section>

      <section className="signals-grid">
        <SignalCard
          description={
            monitorState.session?.apiBaseUrl
              ? `Backend configurado em ${monitorState.session.apiBaseUrl}`
              : 'Insira a URL do backend e o token para iniciar o envio de partidas.'
          }
          eyebrow="Sessão backend"
          footer={
            <StatePill
              label={monitorState.isAuthenticated ? 'Autenticado' : 'Não autenticado'}
              tone={sessionTone}
            />
          }
          icon={ShieldCheck}
          title={monitorState.isAuthenticated ? 'Pronto para sincronizar' : 'Configuracao pendente'}
        />

        <SignalCard
          description={
            monitorState.currentMatch.active
              ? `Tempo atual ${formatDuration(monitorState.currentMatch.gameTimeSeconds)}`
              : 'Aguardando inicio de partida no client.'
          }
          eyebrow="League client"
          footer={<StatePill label={connectionLabel} tone={clientTone} />}
          icon={monitorState.leagueClient === 'disconnected' ? WifiOff : Radar}
          title={
            monitorState.currentMatch.active
              ? monitorState.currentMatch.gameMode ?? 'Partida detectada'
              : 'Sem partida ativa'
          }
        />

        <SignalCard
          description={
            monitorState.lastReport
              ? `${monitorState.lastReport.result.toUpperCase()} em ${formatDuration(
                  monitorState.lastReport.duration,
                )}`
              : 'Nenhuma partida enviada ainda.'
          }
          eyebrow="Ultimo envio"
          footer={
            monitorState.lastReport ? (
              <StatePill
                label={monitorState.lastReport.status === 'sent' ? 'Enviado' : 'Falhou'}
                tone={monitorState.lastReport.status === 'sent' ? 'positive' : 'danger'}
              />
            ) : undefined
          }
          icon={Activity}
          title={
            monitorState.lastReport
              ? new Date(monitorState.lastReport.sentAt).toLocaleString('pt-BR')
              : 'Sem histórico'
          }
        />
      </section>

      <section className="desktop-grid">
        <section className="panel form-panel">
          <div className="form-panel__header">
            <span className="eyebrow">Login por token</span>
            <h3>Configurar conexão do desktop</h3>
            <p>
              Refresh token opcional para manter a sessão ativa sem precisar
              colar um novo access token constantemente.
            </p>
          </div>

          <SessionForm
            accessToken={accessToken}
            apiBaseUrl={apiBaseUrl}
            isSaving={isSaving}
            onAccessTokenChange={setAccessToken}
            onApiBaseUrlChange={setApiBaseUrl}
            onClear={handleClearSession}
            onRefreshTokenChange={setRefreshToken}
            onSave={handleSaveSession}
            refreshToken={refreshToken}
          />
        </section>

        <section className="panel trace-panel">
          <div className="trace-panel__header">
            <span className="eyebrow">Telemetria local</span>
            <h3>Estado atual do monitor</h3>
            <p>Visibilidade rapida para entender o que o desktop conseguiu detectar.</p>
          </div>

          <div className="trace-row">
            <span>Partida ativa</span>
            <strong>{monitorState.currentMatch.active ? 'Sim' : 'Não'}</strong>
          </div>
          <div className="trace-row">
            <span>Game mode</span>
            <strong>{monitorState.currentMatch.gameMode ?? 'Aguardando'}</strong>
          </div>
          <div className="trace-row">
            <span>Mapa</span>
            <strong>{monitorState.currentMatch.mapName ?? 'Aguardando'}</strong>
          </div>
          <div className="trace-row">
            <span>ID da partida</span>
            <strong>{monitorState.currentMatch.externalMatchId ?? 'Indisponível'}</strong>
          </div>
          <div className="trace-row">
            <span>Bridge Electron</span>
            <strong>{window.horizonBoostDesktop ? 'Disponível' : 'Indisponível'}</strong>
          </div>

          {monitorState.lastError ? (
            <div className="error-banner">
              <ArrowUpRight size={14} strokeWidth={2} />
              <span>{monitorState.lastError}</span>
            </div>
          ) : (
            <div className="trace-footnote">
              Somente endpoints locais do client sao utilizados. Nenhuma leitura de
              memória é necessária.
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function formatDuration(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default App
