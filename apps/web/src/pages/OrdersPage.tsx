import { useEffect, useState } from 'react'
import { Eye, Loader2, ShoppingCart, UserRound, X } from 'lucide-react'

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

function formatCurrencyCents(value?: number | string | null) {
  const numeric = Number(value ?? 0)

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric > 999 ? numeric / 100 : numeric)
}

function formatDate(value?: string | null) {
  if (!value) return 'Agora'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
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

function methodLabel(method?: string | null) {
  if (method === 'PIX') return 'PIX'
  if (method === 'DEBIT_CARD') return 'Cartão de débito'
  if (method === 'CREDIT_CARD') return 'Cartão de crédito'
  return 'Pagamento'
}

function trackerLabel(status?: string | null) {
  const labels: Record<string, string> = {
    ONLINE: 'Booster online',
    OFFLINE: 'Booster offline',
    CLIENT_OPEN: 'Client aberto',
    IN_LOBBY: 'Booster em lobby',
    IN_CHAMP_SELECT: 'Selecao de campeoes',
    IN_GAME: 'Booster em partida',
    GAME_ENDED: 'Partida finalizada',
  }

  return labels[status ?? ''] ?? 'Aguardando inicio'
}

function serviceLabel(serviceType?: string | null) {
  if (!serviceType) return 'Serviço Horizon'

  return serviceLabels[serviceType] ?? serviceType
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function rankLabel(value?: unknown) {
  if (typeof value !== 'string' || !value) return null

  return rankLabels[value.toLowerCase()] ?? value
}

function rankKey(value?: unknown) {
  return typeof value === 'string' && value ? value.toLowerCase() : null
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

export function OrdersPage() {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)
  const [chatOrder, setChatOrder] = useState<ServiceOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
            title: 'Pedidos indisponíveis',
            description: getApiErrorMessage(error, 'Não foi possível carregar seus pedidos agora.'),
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

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="purchases-page">
        <section className="purchase-section purchases-content" id="meus-pedidos">
          <div className="section-heading">
            <span className="panel__eyebrow">Área do cliente</span>
            <h2>Meus pedidos</h2>
            <p>Acompanhe seus pedidos, pagamentos e conversas em um só lugar.</p>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <Loader2 className="spin-icon" size={46} />
              <h3>Carregando pedidos</h3>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={64} />
              <h3>Nenhum pedido ainda</h3>
              <p>Monte seu primeiro pedido em Preços para acompanhar tudo por aqui.</p>
            </div>
          ) : (
            <div className="orders-grid">
              {orders.map((order) => {
                const route = routeLabel(order)
                const amount = order.final_price ?? order.latest_payment?.finalAmount ?? order.latest_payment?.amount ?? order.price

                return (
                  <article key={order.id} className="client-order-card">
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
                        <span>Valor</span>
                        <strong>{formatCurrencyCents(amount)}</strong>
                      </div>
                      <div>
                        <span>Pagamento</span>
                        <strong>{statusLabel(order.payment_status)} - {methodLabel(order.payment_method)}</strong>
                      </div>
                      <div>
                        <span>Criado em</span>
                        <strong>{formatDate(order.created_at)}</strong>
                      </div>
                      <div>
                        <span>Acompanhamento</span>
                        <strong>{trackerLabel(order.tracker_status?.status)}</strong>
                      </div>
                    </div>

                    <div className="client-order-card__footer">
                      <div className="client-order-card__booster">
                        <div className="client-order-card__avatar">
                          {order.booster?.profile_photo_path ? <img alt="" src={order.booster.profile_photo_path} /> : <UserRound size={18} />}
                        </div>
                        <div>
                          <span>Responsável pelo pedido</span>
                          <strong>{order.booster?.name ?? 'Aguardando designação'}</strong>
                        </div>
                      </div>

                      <div className="client-order-card__actions">
                        <button className="ghost-button" onClick={() => setSelectedOrder(order)} type="button">
                          <Eye size={15} />
                          Detalhes
                        </button>
                        <OrderChatButton onOpen={setChatOrder} order={order} />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
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
              <div><span>Status do pagamento</span><strong>{statusLabel(selectedOrder.payment_status)}</strong></div>
              <div><span>Booster</span><strong>{selectedOrder.booster?.name ?? 'Aguardando'}</strong></div>
              <div><span>Acompanhamento</span><strong>{trackerLabel(selectedOrder.tracker_status?.status)}</strong></div>
              <div><span>Criado em</span><strong>{formatDate(selectedOrder.created_at)}</strong></div>
            </div>
          </section>
        </div>
      ) : null}

      {chatOrder ? <ChatModal order={chatOrder} onClose={() => setChatOrder(null)} /> : null}
    </AppShell>
  )
}
