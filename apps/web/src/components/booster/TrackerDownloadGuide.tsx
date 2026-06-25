import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Laptop,
  Loader2,
  MonitorDown,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react'

import { getApiErrorMessage } from '@/services/api/errors'
import { systemService } from '@/services/system'
import { useToastStore } from '@/store/useToastStore'
import type { ServiceOrder, TrackerRelease } from '@/types/system'

type ClientPlatform = 'windows' | 'macos' | 'android' | 'ios' | 'desktop_other' | 'unknown'
type StepState = 'done' | 'active' | 'pending' | 'blocked'

interface TrackerDownloadGuideProps {
  assignedOrders?: ServiceOrder[]
  isOpen: boolean
  onClose: () => void
  onStatusRefresh?: () => Promise<void> | void
}

const trackerStatusLabels: Record<string, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  CLIENT_OPEN: 'Client aberto',
  IN_LOBBY: 'Em lobby',
  IN_CHAMP_SELECT: 'Selecao de campeoes',
  IN_GAME: 'Em partida',
  GAME_ENDED: 'Partida finalizada',
}

export function TrackerDownloadGuide({
  assignedOrders = [],
  isOpen,
  onClose,
  onStatusRefresh,
}: TrackerDownloadGuideProps) {
  const addToast = useToastStore((state) => state.addToast)
  const [release, setRelease] = useState<TrackerRelease | null>(null)
  const [isLoadingRelease, setIsLoadingRelease] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null)
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(0)
  const platform = useMemo(() => detectClientPlatform(), [])
  const platformCopy = getPlatformCopy(platform)
  const activeOrders = assignedOrders.filter((order) => !isClosedOrder(order.status))
  const latestSignal = getLatestTrackerSignal(activeOrders)
  const heartbeatSeconds = release?.heartbeat_interval_seconds ?? 15
  const hasRecentSignal = latestSignal?.last_heartbeat_at
    ? nowMs - new Date(latestSignal.last_heartbeat_at).getTime() <= Math.max(45, heartbeatSeconds * 3) * 1000
    : false
  const windowsDownload = release?.downloads.windows
  const canDownloadOnThisDevice = platform === 'windows'
  const canDownload = Boolean(windowsDownload?.available && canDownloadOnThisDevice)
  const steps = buildSteps({
    canDownload,
    downloaded: Boolean(downloadedFile),
    hasActiveOrders: activeOrders.length > 0,
    hasRecentSignal,
    releaseAvailable: Boolean(windowsDownload?.available),
    platform,
  })

  useEffect(() => {
    if (!isOpen) return

    const refreshClock = () => setNowMs(Date.now())
    const firstTick = window.setTimeout(refreshClock, 0)
    const timer = window.setInterval(refreshClock, 15_000)

    return () => {
      window.clearTimeout(firstTick)
      window.clearInterval(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    let active = true

    async function loadRelease() {
      setIsLoadingRelease(true)
      setReleaseError(null)

      try {
        const nextRelease = await systemService.getTrackerRelease(platform)
        if (!active) return

        setRelease(nextRelease)
        await systemService.recordTrackerEvent('setup_opened', {
          active_orders: activeOrders.length,
          download_available: nextRelease.downloads.windows.available,
        }, platform)
      } catch (error: unknown) {
        if (!active) return

        setReleaseError(getApiErrorMessage(error, 'Nao foi possivel carregar o download do Tracker.'))
      } finally {
        if (active) setIsLoadingRelease(false)
      }
    }

    void loadRelease()

    return () => {
      active = false
    }
  }, [activeOrders.length, isOpen, platform])

  if (!isOpen || typeof document === 'undefined') return null

  async function handleDownload() {
    if (!windowsDownload?.available) {
      addToast({
        tone: 'error',
        title: 'Instalador indisponivel',
        description: 'O arquivo do Tracker ainda nao foi publicado neste ambiente.',
      })
      await systemService.recordTrackerEvent('download_unavailable', { reason: 'release_unavailable' }, platform)
      return
    }

    if (!canDownloadOnThisDevice) {
      addToast({
        tone: 'error',
        title: 'Use um PC Windows',
        description: 'O Tracker precisa rodar no mesmo computador em que o League Client esta aberto.',
      })
      await systemService.recordTrackerEvent('download_unavailable', { reason: 'unsupported_device' }, platform)
      return
    }

    setIsDownloading(true)

    try {
      const download = await systemService.downloadTracker(windowsDownload)
      setDownloadedFile(download.filename)
      addToast({
        tone: 'success',
        title: 'Download iniciado',
        description: `${download.filename} foi enviado para sua pasta de downloads.`,
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Download nao concluido',
        description: getApiErrorMessage(error, 'Nao foi possivel baixar o Tracker agora.'),
      })
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleStatusRefresh() {
    setIsRefreshingStatus(true)

    try {
      await systemService.recordTrackerEvent('status_refreshed', {
        active_orders: activeOrders.length,
        latest_signal_at: latestSignal?.last_heartbeat_at ?? null,
      }, platform)
      await onStatusRefresh?.()
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Status nao atualizado',
        description: getApiErrorMessage(error, 'Nao foi possivel atualizar o status do Tracker.'),
      })
    } finally {
      setIsRefreshingStatus(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop tracker-setup-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="tracker-setup-title"
        aria-modal="true"
        className="tracker-setup-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className="confirm-modal__close" onClick={onClose} type="button" aria-label="Fechar guia do Tracker">
          <X size={18} />
        </button>

        <div className="tracker-setup-modal__header">
          <div className="tracker-setup-modal__icon">
            <MonitorDown size={26} />
          </div>
          <div>
            <span className="panel__eyebrow">App do Booster</span>
            <h2 id="tracker-setup-title">Baixar e ativar Tracker</h2>
            <p>Use este guia para instalar o app, conectar sua conta e começar a enviar heartbeat dos pedidos.</p>
          </div>
        </div>

        <div className="tracker-setup-status-grid">
          <StatusTile
            icon={platform === 'android' || platform === 'ios' ? Smartphone : Laptop}
            label="Dispositivo"
            tone={canDownloadOnThisDevice ? 'success' : 'warning'}
            value={platformCopy.label}
          />
          <StatusTile
            icon={Download}
            label="Instalador"
            tone={windowsDownload?.available ? 'success' : 'warning'}
            value={isLoadingRelease ? 'Verificando...' : windowsDownload?.available ? 'Disponivel' : 'Nao publicado'}
          />
          <StatusTile
            icon={Wifi}
            label="Sinal atual"
            tone={hasRecentSignal ? 'success' : latestSignal ? 'warning' : 'neutral'}
            value={hasRecentSignal ? 'Recebendo' : latestSignal ? 'Desatualizado' : 'Sem heartbeat'}
          />
        </div>

        {releaseError ? (
          <div className="tracker-setup-alert is-danger">
            <AlertTriangle size={18} />
            <span>{releaseError}</span>
          </div>
        ) : null}

        {!canDownloadOnThisDevice ? (
          <div className="tracker-setup-alert">
            <Smartphone size={18} />
            <span>{platformCopy.guidance}</span>
          </div>
        ) : null}

        <div className="tracker-setup-progress" aria-label="Progresso de ativacao do Tracker">
          {steps.map((step, index) => (
            <article className={`tracker-setup-step is-${step.state}`} key={step.title}>
              <div className="tracker-setup-step__index">
                {step.state === 'done' ? <CheckCircle2 size={16} /> : String(index + 1).padStart(2, '0')}
              </div>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="tracker-setup-details">
          <div>
            <span>Versao</span>
            <strong>{release?.version ?? 'Verificando'}</strong>
          </div>
          <div>
            <span>Arquivo</span>
            <strong>{windowsDownload?.filename ?? 'Aguardando release'}</strong>
          </div>
          <div>
            <span>Pedido ativo</span>
            <strong>{activeOrders.length ? `${activeOrders.length} pedido(s)` : 'Nenhum'}</strong>
          </div>
          <div>
            <span>Ultimo sinal</span>
            <strong>{latestSignal?.last_heartbeat_at ? formatSignalTime(latestSignal.last_heartbeat_at) : 'Sem sinal'}</strong>
          </div>
        </div>

        {latestSignal ? (
          <div className="tracker-setup-live">
            <ShieldCheck size={18} />
            <span>
              Status do ultimo pedido monitorado: <strong>{trackerStatusLabels[latestSignal.status] ?? latestSignal.status}</strong>
            </span>
          </div>
        ) : null}

        <div className="tracker-setup-actions">
          <button
            className="primary-button primary-button--crimson"
            disabled={isLoadingRelease || isDownloading || !canDownload}
            onClick={() => void handleDownload()}
            type="button"
          >
            {isDownloading ? <Loader2 className="spin-icon" size={17} /> : <Download size={17} />}
            {isDownloading ? 'Baixando...' : downloadedFile ? 'Baixar novamente' : 'Baixar App'}
          </button>
          <button
            className="ghost-button"
            disabled={isRefreshingStatus}
            onClick={() => void handleStatusRefresh()}
            type="button"
          >
            {isRefreshingStatus ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            Atualizar status
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

function StatusTile({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Download
  label: string
  tone: 'success' | 'warning' | 'neutral'
  value: string
}) {
  return (
    <div className={`tracker-setup-status is-${tone}`}>
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function buildSteps({
  canDownload,
  downloaded,
  hasActiveOrders,
  hasRecentSignal,
  releaseAvailable,
  platform,
}: {
  canDownload: boolean
  downloaded: boolean
  hasActiveOrders: boolean
  hasRecentSignal: boolean
  releaseAvailable: boolean
  platform: ClientPlatform
}) {
  const deviceBlocked = platform === 'android' || platform === 'ios' || platform === 'macos' || platform === 'desktop_other'

  return [
    {
      title: 'Baixe no PC Windows',
      description: releaseAvailable
        ? 'O download e autenticado pela sua conta de booster e fica registrado na plataforma.'
        : 'A equipe precisa publicar o instalador antes deste ambiente permitir download.',
      state: downloaded ? 'done' : canDownload ? 'active' : deviceBlocked || !releaseAvailable ? 'blocked' : 'pending',
    },
    {
      title: 'Instale e abra o Tracker',
      description: 'Execute o instalador, abra o app e mantenha o League Client aberto no mesmo computador.',
      state: downloaded ? 'active' : 'pending',
    },
    {
      title: 'Entre e escolha o pedido',
      description: hasActiveOrders
        ? 'Use o mesmo login da plataforma, selecione um pedido atribuido e clique em Iniciar.'
        : 'Pegue um pedido na fila antes de iniciar o acompanhamento.',
      state: hasRecentSignal ? 'done' : hasActiveOrders ? 'active' : 'blocked',
    },
    {
      title: 'Mantenha o sinal ativo',
      description: 'O app envia status, conta Riot detectada, gameflow, progresso ranqueado e partida finalizada.',
      state: hasRecentSignal ? 'done' : 'pending',
    },
  ] satisfies Array<{ title: string; description: string; state: StepState }>
}

function detectClientPlatform(): ClientPlatform {
  if (typeof navigator === 'undefined') return 'unknown'

  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (/android/.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/.test(userAgent) || (platform === 'macintel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/win/.test(platform)) return 'windows'
  if (/mac/.test(platform)) return 'macos'
  if (/linux/.test(platform)) return 'desktop_other'

  return 'unknown'
}

function getPlatformCopy(platform: ClientPlatform) {
  if (platform === 'windows') {
    return {
      label: 'Windows',
      guidance: 'Voce esta no dispositivo correto para instalar o Tracker.',
    }
  }

  if (platform === 'android') {
    return {
      label: 'Android',
      guidance: 'No Android voce pode acompanhar o guia, mas o Tracker precisa ser baixado e executado no PC Windows onde o League of Legends esta instalado.',
    }
  }

  if (platform === 'ios') {
    return {
      label: 'iPhone/iPad',
      guidance: 'No iPhone voce pode acompanhar o guia, mas o Tracker precisa ser baixado e executado no PC Windows onde o League of Legends esta instalado.',
    }
  }

  if (platform === 'macos') {
    return {
      label: 'macOS',
      guidance: 'A versao publicada do Tracker e para Windows. Abra esta area em um PC Windows para baixar e conectar ao League Client.',
    }
  }

  return {
    label: 'Desktop',
    guidance: 'A versao publicada do Tracker e para Windows. Abra esta area em um PC Windows para baixar e conectar ao League Client.',
  }
}

function getLatestTrackerSignal(orders: ServiceOrder[]) {
  return orders
    .map((order) => order.tracker_status)
    .filter((status): status is NonNullable<ServiceOrder['tracker_status']> => Boolean(status?.last_heartbeat_at))
    .sort((first, second) =>
      new Date(second.last_heartbeat_at ?? 0).getTime() - new Date(first.last_heartbeat_at ?? 0).getTime(),
    )[0] ?? null
}

function isClosedOrder(status?: string | null) {
  return ['COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED'].includes(status ?? '')
}

function formatSignalTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
