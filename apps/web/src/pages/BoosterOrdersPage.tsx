import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, Loader2, ShoppingBag, UserRound, X } from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { ChatModal } from '@/components/chat/ChatModal'
import { OrderChatButton } from '@/components/chat/OrderChatButton'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { ServiceOrder } from '@/types/system'

const rankLabels: Record<string, string> = {
  iron: 'Ferro',
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  platinum: 'Platina',
  emerald: 'Esmeralda',
  diamond: 'Diamante',
  master: 'Mestre',
  grandmaster: 'Grão-mestre',
  challenger: 'Desafiante',
  sovereign: 'Soberano',
}

const serviceLabels: Record<string, string> = {
  solo_boost_division: 'Boost Solo - Divisão',
  duo_boost_division: 'Boost Duo - Divisão',
  flex_boost_division: 'Boost Flex - Divisão',
  wins_by_rank: 'Vitórias por elo',
}

const boosterPayoutRate = 0.6

const addonLabels: Record<string, string> = {
  mmr_profile: 'Perfil de MMR',
  chat_offline: 'Chat offline',
  flash_position: 'Posição de feitiços',
  specific_routes: 'Rotas específicas',
  priority_service: 'Prioritário',
  favorite_booster: 'Booster favorito',
  extra_win: 'Vitória extra',
  specific_champions: 'Campeões específicos',
  restricted_hours: 'Horário restrito',
  stream_online: 'Stream online',
  reduce_kda: 'Reduzir KDA',
  reduce_delivery: 'Entrega reduzida',
  solo_only: 'Apenas solo',
}

function formatCurrencyCents(value?: number | string | null) {
  const numeric = Number(value ?? 0)

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric > 999 ? numeric / 100 : numeric)
}

function getBoosterPayout(value?: number | string | null) {
  return Number(value ?? 0) * boosterPayoutRate
}

function getOrderAmount(order: ServiceOrder) {
  return order.final_price ?? order.latest_payment?.finalAmount ?? order.latest_payment?.amount ?? order.price
}

function getAddonTags(order: ServiceOrder) {
  const addons = order.metadata?.addons

  if (!addons || typeof addons !== 'object' || Array.isArray(addons)) return []

  return Object.entries(addons as Record<string, unknown>)
    .filter(([, value]) => {
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') return value.trim().length > 0 && value !== 'none'
      if (Array.isArray(value)) return value.length > 0
      return value !== null && value !== undefined
    })
    .map(([key, value]) => {
      const label = addonLabels[key] ?? key

      if (Array.isArray(value)) return `${label}: ${value.join(', ')}`
      if (typeof value === 'string' && !['true', 'false'].includes(value)) return `${label}: ${value}`

      return label
    })
}

function formatDate(value?: string | null) {
  if (!value) return 'Data indisponível'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatShortDateTime(value?: string | null) {
  if (!value) return 'A definir'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getDeliveryDeadline(order: ServiceOrder) {
  const metadata = order.metadata ?? {}
  const explicitDeadline = [
    metadata.delivery_deadline_at,
    metadata.delivery_deadline,
    metadata.deadline_at,
    metadata.due_at,
  ].find((value) => typeof value === 'string' && value.length)

  if (typeof explicitDeadline === 'string') return explicitDeadline
  if (!order.created_at) return null

  const fallbackDeadline = new Date(order.created_at)
  fallbackDeadline.setDate(fallbackDeadline.getDate() + 1)

  return fallbackDeadline.toISOString()
}

function getPriorityTone(deadline?: string | null) {
  if (!deadline) return 'waiting'

  const remaining = new Date(deadline).getTime() - Date.now()
  const hours = remaining / 1000 / 60 / 60

  if (hours <= 6) return 'danger'
  if (hours <= 18) return 'active'

  return 'waiting'
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    WAITING_PAYMENT: 'Aguardando pagamento',
    PAID: 'Pago',
    WAITING_BOOSTER: 'Aguardando booster',
    BOOSTER_ASSIGNED: 'Booster designado',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    FAILED: 'Falhou',
    EXPIRED: 'Expirado',
    REFUNDED: 'Reembolsado',
  }

  return labels[status ?? ''] ?? status ?? 'Pendente'
}

function statusTone(status?: string | null) {
  if (status === 'PAID' || status === 'COMPLETED') return 'success'
  if (status === 'EXPIRED' || status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'IN_PROGRESS' || status === 'BOOSTER_ASSIGNED') return 'active'

  return 'waiting'
}

function serviceLabel(serviceType?: string | null) {
  if (!serviceType) return 'Serviço Horizon'

  return serviceLabels[serviceType] ?? serviceType
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function rankKey(value?: unknown) {
  return typeof value === 'string' && value ? value.toLowerCase() : null
}

function rankLabel(value?: unknown) {
  const key = rankKey(value)

  return key ? rankLabels[key] ?? String(value) : null
}

function tierDivisionLabel(tier?: unknown, division?: unknown) {
  const tierText = rankLabel(tier)
  const divisionText = typeof division === 'string' && division ? division : null

  return [tierText, divisionText].filter(Boolean).join(' ') || null
}

function RankEmblem({ tier }: { tier?: unknown }) {
  const key = rankKey(tier)
  const label = rankLabel(tier) ?? 'Elo'

  return (
    <div className={`client-order-card__rank-icon${key ? ` is-${key}` : ''}`} aria-hidden="true">
      {key ? (
        <img
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
          src={`/ranks/${key}.png`}
        />
      ) : null}
      <span>{label.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

function routeLabel(order: ServiceOrder) {
  const metadata = order.metadata ?? {}
  const current = tierDivisionLabel(metadata.current_tier, metadata.current_division)
  const target = tierDivisionLabel(metadata.target_tier, metadata.target_division)
  const summary = typeof metadata.quote_summary === 'string' ? metadata.quote_summary : null

  return {
    current: current || 'Conferir detalhes',
    currentTier: metadata.current_tier,
    target: target || summary || 'Conferir detalhes',
    targetTier: metadata.target_tier,
  }
}

export function BoosterOrdersPage() {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)
  const [chatOrder, setChatOrder] = useState<ServiceOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(null)
  const activeOrders = useMemo(
    () => orders.filter((order) => !['COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED'].includes(order.status)),
    [orders],
  )
  const priorityOrders = useMemo(
    () =>
      [...activeOrders]
        .sort((firstOrder, secondOrder) => {
          const firstDeadline = getDeliveryDeadline(firstOrder)
          const secondDeadline = getDeliveryDeadline(secondOrder)

          return new Date(firstDeadline ?? firstOrder.created_at ?? 0).getTime()
            - new Date(secondDeadline ?? secondOrder.created_at ?? 0).getTime()
        })
        .slice(0, 4),
    [activeOrders],
  )

  useEffect(() => {
    let active = true

    async function loadOrders() {
      try {
        const nextOrders = await systemService.getOrders()
        if (active) setOrders(nextOrders)
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Serviços indisponíveis',
            description: getApiErrorMessage(error, 'Não foi possível carregar seus serviços agora.'),
          })
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadOrders()

    return () => {
      active = false
    }
  }, [addToast])

  async function handleLogout() {
    await authService.logout()
  }

  async function handleCompleteOrder(orderId: number) {
    setCompletingOrderId(orderId)

    try {
      const completedOrder = await systemService.completeBoosterOrder(orderId)
      setOrders((current) => current.filter((order) => order.id !== completedOrder.id))
      addToast({
        tone: 'success',
        title: 'Serviço finalizado',
        description: 'Esse boost já pode ser solicitado para saque no Financeiro.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível finalizar',
        description: getApiErrorMessage(error, 'Confira o status do pedido e tente novamente.'),
      })
    } finally {
      setCompletingOrderId(null)
    }
  }

  return (
    <AppShell userName={user?.name || 'Booster'} onLogout={handleLogout}>
      <div className="purchases-page booster-orders-page">
        <section className="purchase-section purchases-content">
          <div className="section-heading">
            <span className="panel__eyebrow">Área do booster</span>
            <h2>Meus serviços</h2>
            <p>Pedidos atribuídos, chat com o cliente e datas reais do serviço.</p>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <Loader2 className="spin-icon" size={46} />
              <h3>Carregando serviços</h3>
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="empty-state">
              <ShoppingBag size={64} />
              <h3>Nenhum serviço ativo</h3>
              <p>Quando você pegar um pedido na fila, ele aparece aqui até ser finalizado.</p>
            </div>
          ) : (
            <>
              <section className="booster-priority-queue">
                <div className="booster-priority-queue__header">
                  <div>
                    <span className="panel__eyebrow">Fila de prioridade</span>
                    <h3>Atenda primeiro</h3>
                  </div>
                  <AlertTriangle size={22} />
                </div>

                {priorityOrders.length ? (
                  <div className="booster-priority-queue__list">
                    {priorityOrders.map((order, index) => {
                      const route = routeLabel(order)
                      const deadline = getDeliveryDeadline(order)

                      return (
                        <article className="booster-priority-card" key={order.id}>
                          <div className="booster-priority-card__index">{String(index + 1).padStart(2, '0')}</div>
                          <div className="booster-priority-card__body">
                            <span>Pedido #{order.id}</span>
                            <strong>{route.current} para {route.target}</strong>
                            <small>{order.customer?.name ?? 'Cliente sem nome'}</small>
                          </div>
                          <div className="booster-priority-card__deadline">
                            <Clock3 size={15} />
                            <span>{formatShortDateTime(deadline)}</span>
                          </div>
                          <span className={`finance-status is-${getPriorityTone(deadline)}`}>Prioridade</span>
                          <OrderChatButton onOpen={setChatOrder} order={{ ...order, chat_available: order.chat_available ?? true }} />
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="finance-empty-state">
                    <Clock3 size={38} />
                    <strong>Nada urgente agora</strong>
                    <span>Pedidos ativos entram aqui por ordem de prazo.</span>
                  </div>
                )}
              </section>

              <div className="orders-grid">
                {activeOrders.map((order) => {
                const route = routeLabel(order)
                const amount = getOrderAmount(order)
                const addonTags = getAddonTags(order)

                return (
                  <article key={order.id} className="client-order-card booster-assigned-card">
                    <div className="client-order-card__top">
                      <div>
                        <span>Pedido #{order.id}</span>
                        <h3>{serviceLabel(order.service_type)}</h3>
                      </div>
                      <strong className={`client-order-card__status is-${statusTone(order.status)}`}>
                        {statusLabel(order.status)}
                      </strong>
                    </div>

                    <div className="client-order-card__journey">
                      <div className="client-order-card__rank">
                        <RankEmblem tier={route.currentTier} />
                        <span>Elo atual</span>
                        <strong>{route.current}</strong>
                      </div>
                      <span className="client-order-card__arrow">para</span>
                      <div className="client-order-card__rank">
                        <RankEmblem tier={route.targetTier} />
                        <span>Elo desejado</span>
                        <strong>{route.target}</strong>
                      </div>
                    </div>

                    <div className="client-order-card__meta">
                      <div>
                        <span>Cliente</span>
                        <strong>{order.customer?.name ?? 'Cliente sem nome'}</strong>
                      </div>
                      <div>
                        <span>Seu ganho</span>
                        <strong>{formatCurrencyCents(getBoosterPayout(amount))}</strong>
                      </div>
                      <div>
                        <span>Criado em</span>
                        <strong>{formatDate(order.created_at)}</strong>
                      </div>
                    </div>

                    {addonTags.length ? (
                      <div className="booster-addon-tags" aria-label="Adicionais do pedido">
                        {addonTags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    ) : null}

                    <div className="client-order-card__footer">
                      <div className="client-order-card__booster">
                        <div className="client-order-card__avatar">
                          {order.customer?.profile_photo_path ? <img alt="" src={order.customer.profile_photo_path} /> : <UserRound size={18} />}
                        </div>
                        <div>
                          <span>Cliente do pedido</span>
                          <strong>{order.customer?.name ?? 'Cliente sem nome'}</strong>
                        </div>
                      </div>

                      <div className="client-order-card__actions">
                        <button className="ghost-button" onClick={() => setSelectedOrder(order)} type="button">
                          <Eye size={15} />
                          Detalhes
                        </button>
                        {order.status !== 'COMPLETED' ? (
                          <button
                            className="ghost-button"
                            disabled={completingOrderId === order.id}
                            onClick={() => void handleCompleteOrder(order.id)}
                            type="button"
                          >
                            <CheckCircle2 size={15} />
                            {completingOrderId === order.id ? 'Finalizando...' : 'Finalizar serviço'}
                          </button>
                        ) : (
                          <span className="finance-status is-success">Liberado para saque</span>
                        )}
                        <OrderChatButton onOpen={setChatOrder} order={{ ...order, chat_available: order.chat_available ?? true }} />
                      </div>
                    </div>
                  </article>
                )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedOrder ? (
        <div className="modal-backdrop" onMouseDown={() => setSelectedOrder(null)}>
          <section className="order-detail-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className="confirm-modal__close" type="button" onClick={() => setSelectedOrder(null)} aria-label="Fechar detalhes">
              <X size={18} />
            </button>
            <span className="panel__eyebrow">Pedido #{selectedOrder.id}</span>
            <h2>{serviceLabel(selectedOrder.service_type)}</h2>
            <p>{selectedOrder.description}</p>
            <div className="client-order-card__meta">
              <div><span>Status do pedido</span><strong>{statusLabel(selectedOrder.status)}</strong></div>
              <div><span>Cliente</span><strong>{selectedOrder.customer?.name ?? 'Cliente sem nome'}</strong></div>
              <div><span>Seu ganho</span><strong>{formatCurrencyCents(getBoosterPayout(getOrderAmount(selectedOrder)))}</strong></div>
              <div><span>Criado em</span><strong>{formatDate(selectedOrder.created_at)}</strong></div>
            </div>
            {getAddonTags(selectedOrder).length ? (
              <div className="booster-addon-tags" aria-label="Adicionais do pedido">
                {getAddonTags(selectedOrder).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {chatOrder ? <ChatModal order={chatOrder} onClose={() => setChatOrder(null)} /> : null}
    </AppShell>
  )
}
