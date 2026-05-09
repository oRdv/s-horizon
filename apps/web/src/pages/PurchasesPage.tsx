import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Eye, Loader2, MessageCircle, Send, ShoppingCart, UserRound, X } from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { PricingBuilder } from '@/components/PricingBuilder'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { OrderChatMessage, PaymentTransaction, ServiceOrder } from '@/types/system'

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
    COMPLETED: 'Concluido',
    CANCELLED: 'Cancelado',
    FAILED: 'Falhou',
    EXPIRED: 'Expirado',
    REFUNDED: 'Reembolsado',
  }

  return labels[status ?? ''] ?? status ?? 'Pendente'
}

function methodLabel(method?: string | null) {
  if (method === 'PIX') return 'PIX'
  if (method === 'DEBIT_CARD') return 'Cartao de debito'
  if (method === 'CREDIT_CARD') return 'Cartao de credito'
  return 'Pagamento'
}

function routeLabel(order: ServiceOrder) {
  const metadata = order.metadata ?? {}
  const ladder = metadata.ladder_text
  const current = [metadata.current_tier, metadata.current_division].filter(Boolean).join(' ')
  const target = [metadata.target_tier, metadata.target_division].filter(Boolean).join(' ')

  return {
    ladder: typeof ladder === 'string' ? ladder : order.title,
    current: current || 'Conferir detalhes',
    target: target || (typeof metadata.quote_summary === 'string' ? metadata.quote_summary : 'Conferir detalhes'),
  }
}

function OrderChatModal({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [messages, setMessages] = useState<OrderChatMessage[]>([])
  const [body, setBody] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const canSend = !['CANCELLED', 'COMPLETED'].includes(order.status)

  useEffect(() => {
    let active = true

    async function loadChat() {
      try {
        const chat = await systemService.getOrderChat(order.id)
        if (active) setMessages(chat.messages)
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Chat indisponivel',
            description: getApiErrorMessage(error, 'Nao foi possivel carregar a conversa.'),
          })
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadChat()
    const interval = window.setInterval(() => void loadChat(), 5000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [addToast, order.id])

  async function handleSend() {
    const text = body.trim()
    if (!text || isSending || !canSend) return

    setIsSending(true)
    try {
      const message = await systemService.sendOrderChatMessage(order.id, text)
      setMessages((current) => [...current, message])
      setBody('')
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Mensagem nao enviada',
        description: getApiErrorMessage(error, 'Tente novamente em alguns segundos.'),
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="order-chat-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button className="confirm-modal__close" type="button" onClick={onClose} aria-label="Fechar chat">
          <X size={18} />
        </button>
        <div className="order-chat-modal__header">
          <span className="panel__eyebrow">Chat do pedido #{order.id}</span>
          <h2>{order.booster?.name ?? 'Booster designado'}</h2>
        </div>
        <div className="order-chat-modal__messages">
          {isLoading ? (
            <Loader2 className="spin-icon" size={32} />
          ) : messages.length ? (
            messages.map((message) => (
              <div
                className={`order-chat-message${message.sender_id === user?.id ? ' is-own' : ''}`}
                key={message.id}
              >
                <span>{message.sender?.name ?? 'Equipe Horizon'} · {formatDate(message.created_at)}</span>
                <p>{message.body}</p>
              </div>
            ))
          ) : (
            <p className="order-chat-modal__empty">Conversa liberada. Envie a primeira mensagem para alinhar o servico.</p>
          )}
        </div>
        <div className="order-chat-modal__composer">
          <input
            disabled={!canSend || isSending}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSend()
            }}
            placeholder={canSend ? 'Escreva sua mensagem' : 'Chat bloqueado para pedidos finalizados'}
            value={body}
          />
          <button className="primary-button primary-button--crimson" disabled={!body.trim() || !canSend || isSending} onClick={() => void handleSend()} type="button">
            {isSending ? <Loader2 className="spin-icon" size={16} /> : <Send size={16} />}
            Enviar
          </button>
        </div>
      </section>
    </div>
  )
}

export function PurchasesPage() {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null)
  const [chatOrder, setChatOrder] = useState<ServiceOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const paidOrders = useMemo(() => orders.filter((order) => order.payment_status === 'PAID').length, [orders])

  async function loadOrders() {
    try {
      const nextOrders = await systemService.getOrders()
      setOrders(nextOrders)
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Pedidos indisponiveis',
        description: getApiErrorMessage(error, 'Nao foi possivel carregar seus pedidos agora.'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [])

  async function handleLogout() {
    await authService.logout()
  }

  function handleOrderCreated(payload: { transaction: PaymentTransaction; order: ServiceOrder }) {
    setOrders((currentOrders) => [
      {
        ...payload.order,
        latest_payment: payload.transaction,
        payment_status: payload.transaction.status,
        final_price: payload.transaction.finalAmount ?? payload.transaction.amount as number,
      },
      ...currentOrders.filter((order) => order.id !== payload.order.id),
    ])
  }

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="purchases-page">
        <section className="purchase-section" id="novo-pedido">
          <PricingBuilder
            description="Escolha o formato, ajuste o elo atual e o destino final. O valor aparece no resumo antes de voce fechar."
            eyebrow="Novo pedido"
            onOrderCreated={handleOrderCreated}
            showReferenceTable={false}
            title="Escolha o servico e monte sua rota"
          />
        </section>

        <section className="purchase-section purchases-content" id="meus-pedidos">
          <div className="section-heading">
            <span className="panel__eyebrow">Historico do cliente</span>
            <h2>Todos os pedidos</h2>
            <p>Status de pagamento e execucao sempre vindos do backend.</p>
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
              <p>Monte seu primeiro pedido acima para acompanhar tudo por aqui.</p>
            </div>
          ) : (
            <div className="orders-grid">
              {orders.map((order) => {
                const route = routeLabel(order)
                const amount = order.final_price ?? order.latest_payment?.finalAmount ?? order.latest_payment?.amount ?? order.price
                return (
                  <article key={order.id} className="client-order-card">
                    <div className="client-order-card__top">
                      <span>Pedido #{order.id}</span>
                      <strong>{statusLabel(order.status)}</strong>
                    </div>
                    <h3>{order.service_type}</h3>
                    <p>{route.ladder}</p>
                    <div className="client-order-card__meta">
                      <div>
                        <span>Elo atual</span>
                        <strong>{route.current}</strong>
                      </div>
                      <div>
                        <span>Elo desejado</span>
                        <strong>{route.target}</strong>
                      </div>
                      <div>
                        <span>Valor pago</span>
                        <strong>{formatCurrencyCents(amount)}</strong>
                      </div>
                      <div>
                        <span>Pagamento</span>
                        <strong>{statusLabel(order.payment_status)} · {methodLabel(order.payment_method)}</strong>
                      </div>
                    </div>
                    <div className="client-order-card__booster">
                      <div className="client-order-card__avatar">
                        {order.booster?.profile_photo_path ? <img alt="" src={order.booster.profile_photo_path} /> : <UserRound size={18} />}
                      </div>
                      <div>
                        <span>Booster responsavel</span>
                        <strong>{order.booster?.name ?? 'Aguardando designacao'}</strong>
                      </div>
                    </div>
                    <div className="client-order-card__footer">
                      <span><CalendarClock size={15} /> {formatDate(order.created_at)}</span>
                      <div>
                        <button className="ghost-button" onClick={() => setSelectedOrder(order)} type="button">
                          <Eye size={15} />
                          Detalhes
                        </button>
                        <button className="primary-button primary-button--crimson" disabled={!order.chat_available} onClick={() => setChatOrder(order)} type="button">
                          <MessageCircle size={15} />
                          Abrir chat
                        </button>
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
            <h2>{selectedOrder.title}</h2>
            <p>{selectedOrder.description}</p>
            <div className="client-order-card__meta">
              <div><span>Status do pedido</span><strong>{statusLabel(selectedOrder.status)}</strong></div>
              <div><span>Status do pagamento</span><strong>{statusLabel(selectedOrder.payment_status)}</strong></div>
              <div><span>Booster</span><strong>{selectedOrder.booster?.name ?? 'Aguardando'}</strong></div>
              <div><span>Criado em</span><strong>{formatDate(selectedOrder.created_at)}</strong></div>
            </div>
          </section>
        </div>
      ) : null}

      {chatOrder ? <OrderChatModal order={chatOrder} onClose={() => setChatOrder(null)} /> : null}
    </AppShell>
  )
}
