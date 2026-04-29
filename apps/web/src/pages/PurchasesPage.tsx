import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, ShoppingCart } from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { PricingBuilder } from '@/components/PricingBuilder'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { PaymentTransaction, ServiceOrder } from '@/types/system'

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value))
}

function formatPaymentMethod(method: PaymentTransaction['method']) {
  return method === 'pix' ? 'Pix' : 'Cartao'
}

function formatPaymentProvider(provider: PaymentTransaction['provider']) {
  if (provider === 'mercado_pago') {
    return 'Mercado Pago'
  }

  return provider === 'stripe' ? 'Stripe' : 'Manual'
}

function formatPaymentStatus(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    failed: 'Falhou',
    refunded: 'Reembolsado',
  }

  return labels[status] ?? status
}

export function PurchasesPage() {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)

  useEffect(() => {
    let active = true

    async function loadPayments() {
      try {
        const nextPayments = await systemService.getPayments()

        if (active) {
          setPayments(nextPayments)
          setOrders(
            nextPayments
              .map((payment) => payment.service_order)
              .filter((order): order is ServiceOrder => Boolean(order)),
          )
        }
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Historico indisponivel',
            description: getApiErrorMessage(error, 'Nao foi possivel carregar seus pedidos agora.'),
          })
        }
      } finally {
        if (active) {
          setIsLoadingPayments(false)
        }
      }
    }

    void loadPayments()

    return () => {
      active = false
    }
  }, [addToast])

  async function handleLogout() {
    await authService.logout()
  }

  function handleOrderCreated(payload: { transaction: PaymentTransaction; order: ServiceOrder }) {
    setPayments((currentPayments) => [
      payload.transaction,
      ...currentPayments.filter((payment) => payment.id !== payload.transaction.id),
    ])
    setOrders((currentOrders) => [payload.order, ...currentOrders.filter((order) => order.id !== payload.order.id)])
  }

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="purchases-page">
        <section className="purchases-hero panel">
          <div className="purchases-hero__copy">
            <span className="panel__eyebrow">Area do cliente</span>
            <h1>Monte sua rota, veja o valor e feche o pedido sem adivinhacao.</h1>
          </div>
        </section>

        <section className="purchase-section" id="tabela-precos">
          <PricingBuilder
            description="Escolha o formato, ajuste o elo atual e o destino final. A Horizon recalcula tudo na hora com os tiers atuais do LoL."
            eyebrow="Tabela de precos"
            onOrderCreated={handleOrderCreated}
            title="Escolha o servico e monte sua rota"
          />
        </section>

        <section className="purchase-section purchases-content" id="meus-pedidos">
          <div className="section-heading">
            <span className="panel__eyebrow">Historico do cliente</span>
            <h2>Meus pedidos</h2>
            <p>Pedidos criados pela calculadora aparecem aqui com valor, metodo e status.</p>
          </div>

          {isLoadingPayments ? (
            <div className="empty-state">
              <Loader2 className="spin-icon" size={46} />
              <h3>Carregando pedidos</h3>
              <p>Estamos buscando seu historico de compras.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={64} />
              <h3>Nenhum pedido ainda</h3>
              <p>Escolha um servico na tabela para criar seu primeiro pedido como cliente.</p>
            </div>
          ) : (
            <div className="purchases-list">
              {payments.map((payment) => (
                <article key={payment.id} className="purchase-card">
                  <div className="purchase-info">
                    <h4>{payment.service_order?.title ?? 'Pedido Horizon Boost'}</h4>
                    <p>
                      {formatPaymentProvider(payment.provider)} · {formatPaymentMethod(payment.method)}
                    </p>
                    <p>Valor: {formatCurrency(payment.amount)}</p>
                  </div>
                  <div className="purchase-status">
                    {payment.status === 'paid' ? (
                      <div className="status-completed">
                        <CheckCircle size={20} />
                        <span>{formatPaymentStatus(payment.status)}</span>
                      </div>
                    ) : (
                      <div className="status-progress">
                        <span className="status-dot" />
                        <span>{formatPaymentStatus(payment.status)}</span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {orders.length ? (
            <div className="purchase-order-strip panel">
              <span className="panel__eyebrow">Pedidos recentes</span>
              <div className="purchase-order-strip__list">
                {orders.slice(0, 3).map((order) => (
                  <div className="purchase-order-strip__item" key={order.id}>
                    <strong>{order.title}</strong>
                    <span>
                      {order.status} · {formatCurrency(order.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  )
}
