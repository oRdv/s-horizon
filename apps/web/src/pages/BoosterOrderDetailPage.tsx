import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { TrackerDownloadGuide } from '@/components/booster/TrackerDownloadGuide'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { ServiceOrder } from '@/types/system'

const availableStatuses = new Set(['PAID', 'WAITING_BOOSTER'])

function formatCurrencyCents(value?: number | string | null) {
  const numeric = Number(value ?? 0)

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric > 999 ? numeric / 100 : numeric)
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    WAITING_PAYMENT: 'Aguardando pagamento',
    PAID: 'Pago',
    WAITING_BOOSTER: 'Disponivel para boosters',
    BOOSTER_ASSIGNED: 'Booster designado',
    ASSIGNED: 'Designado',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluido',
    CANCELLED: 'Cancelado',
    FAILED: 'Falhou',
    EXPIRED: 'Expirado',
    REFUNDED: 'Reembolsado',
  }

  return labels[status ?? ''] ?? status ?? 'Pendente'
}

function serviceLabel(serviceType?: string | null) {
  if (!serviceType) return 'Servico Horizon'

  const labels: Record<string, string> = {
    solo_boost_division: 'Boost Solo - Divisao',
    duo_boost_division: 'Boost Duo - Divisao',
    flex_boost_division: 'Boost Flex - Divisao',
    wins_by_rank: 'Vitorias por elo',
  }

  return labels[serviceType] ?? serviceType
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function routeLabel(order: ServiceOrder) {
  const metadata = order.metadata ?? {}
  const current = [metadata.current_tier ?? metadata.current_rank, metadata.current_division]
    .filter((value) => typeof value === 'string' && value.length)
    .join(' ')
  const target = [metadata.target_tier ?? metadata.desired_rank, metadata.target_division]
    .filter((value) => typeof value === 'string' && value.length)
    .join(' ')

  if (current && target) return `${current} para ${target}`

  return typeof metadata.quote_summary === 'string' ? metadata.quote_summary : order.title
}

function getOrderAmount(order: ServiceOrder) {
  return order.final_price ?? order.latest_payment?.finalAmount ?? order.latest_payment?.amount ?? order.price
}

export function BoosterOrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isTrackerGuideOpen, setIsTrackerGuideOpen] = useState(searchParams.get('tracker') === '1')

  const numericOrderId = Number(orderId)
  const isAssignedToCurrentUser = Boolean(order?.booster?.id && order.booster.id === user?.id)
  const isAvailable = Boolean(order && availableStatuses.has(order.status) && !order.booster)
  const shouldHighlightClaim = searchParams.get('action') === 'claim'

  const trackerOrders = useMemo(
    () => (order && isAssignedToCurrentUser ? [order] : []),
    [isAssignedToCurrentUser, order],
  )

  useEffect(() => {
    let active = true

    async function loadOrder() {
      if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) {
        setError('Pedido invalido.')
        setIsLoading(false)
        return
      }

      try {
        const nextOrder = await systemService.getOrder(numericOrderId)
        if (active) {
          setOrder(nextOrder)
          setError(null)
        }
      } catch (requestError: unknown) {
        if (active) {
          setError(getApiErrorMessage(requestError, 'Nao foi possivel abrir este pedido.'))
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadOrder()

    return () => {
      active = false
    }
  }, [numericOrderId])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function refreshOrder() {
    if (!Number.isFinite(numericOrderId) || numericOrderId <= 0) return

    const nextOrder = await systemService.getOrder(numericOrderId)
    setOrder(nextOrder)
  }

  async function handleClaim() {
    if (!order) return

    setIsClaiming(true)

    try {
      const claimedOrder = await systemService.claimBoosterOrder(order.id)
      setOrder(claimedOrder)
      addToast({
        tone: 'success',
        title: 'Pedido aceito',
        description: 'O pedido foi atribuido a voce. Abra o Tracker antes de iniciar.',
      })
    } catch (claimError: unknown) {
      await refreshOrder().catch(() => undefined)
      addToast({
        tone: 'error',
        title: 'Pedido nao aceito',
        description: getApiErrorMessage(claimError, 'Este pedido pode ja ter sido aceito por outro booster.'),
      })
    } finally {
      setIsClaiming(false)
    }
  }

  return (
    <AppShell userName={user?.name || 'Booster'} onLogout={handleLogout}>
      <div className="purchases-page booster-order-detail-page">
        <section className="purchase-section purchases-content">
          <div className="section-heading">
            <span className="panel__eyebrow">Oportunidade do Discord</span>
            <h2>{order ? `Pedido #${order.id}` : 'Pedido'}</h2>
            <p>Confira o estado atual antes de aceitar. A validacao final acontece na API.</p>
            <div className="section-heading__actions">
              <Link className="ghost-button" to="/booster/orders">
                <ArrowLeft size={16} />
                Meus servicos
              </Link>
              <button className="ghost-button" onClick={() => void refreshOrder()} type="button">
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <Loader2 className="spin-icon" size={46} />
              <h3>Carregando pedido</h3>
            </div>
          ) : error ? (
            <div className="empty-state">
              <LockKeyhole size={56} />
              <h3>Acesso indisponivel</h3>
              <p>{error}</p>
            </div>
          ) : order ? (
            <article className="client-order-card booster-discord-order-card">
              <div className="client-order-card__top">
                <div>
                  <span>{serviceLabel(order.service_type)}</span>
                  <h3>{routeLabel(order)}</h3>
                </div>
                <strong className="client-order-card__status is-active">{statusLabel(order.status)}</strong>
              </div>

              <div className="client-order-card__meta">
                <div>
                  <span>Cliente</span>
                  <strong>{order.customer?.name ?? 'Cliente sem nome'}</strong>
                </div>
                <div>
                  <span>Valor</span>
                  <strong>{formatCurrencyCents(getOrderAmount(order))}</strong>
                </div>
                <div>
                  <span>Booster</span>
                  <strong>{order.booster?.name ?? 'Ainda disponivel'}</strong>
                </div>
              </div>

              <div className="discord-order-state">
                {isAvailable ? (
                  <>
                    <ShieldCheck size={24} />
                    <div>
                      <strong>Pedido disponivel para aceite</strong>
                      <span>Apenas boosters ativos podem confirmar. Se outro booster aceitar primeiro, a API bloqueia sua tentativa.</span>
                    </div>
                  </>
                ) : isAssignedToCurrentUser ? (
                  <>
                    <CheckCircle2 size={24} />
                    <div>
                      <strong>Pedido atribuido a voce</strong>
                      <span>Abra o Tracker e acompanhe o progresso pelo app desktop.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={24} />
                    <div>
                      <strong>Pedido nao esta mais disponivel</strong>
                      <span>Ele pode ter sido aceito por outro booster ou alterado pela equipe.</span>
                    </div>
                  </>
                )}
              </div>

              <div className="client-order-card__actions">
                {isAvailable ? (
                  <button
                    className={`primary-button${shouldHighlightClaim ? ' primary-button--crimson' : ''}`}
                    disabled={isClaiming}
                    onClick={() => void handleClaim()}
                    type="button"
                  >
                    {isClaiming ? 'Aceitando...' : 'Aceitar pedido'}
                  </button>
                ) : null}
                <button className="ghost-button" onClick={() => setIsTrackerGuideOpen(true)} type="button">
                  <Download size={16} />
                  Baixar Tracker
                </button>
                <Link className="ghost-button" to="/dashboard">
                  Abrir dashboard
                </Link>
              </div>
            </article>
          ) : null}
        </section>
      </div>

      <TrackerDownloadGuide
        assignedOrders={trackerOrders}
        isOpen={isTrackerGuideOpen}
        onClose={() => setIsTrackerGuideOpen(false)}
        onStatusRefresh={refreshOrder}
      />
    </AppShell>
  )
}
