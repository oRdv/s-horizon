import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { PaymentTransaction } from '@/types/system'

interface PricingOffer {
  id: string
  title: string
  subtitle: string
  description: string
  serviceType: string
  amount: number
  estimate: string
  icon: typeof Zap
  highlights: string[]
  featured?: boolean
}

const pricingOffers: PricingOffer[] = [
  {
    id: 'soloqueue-boost',
    title: 'Soloqueue Boost',
    subtitle: 'Do elo atual ao alvo combinado',
    description: 'Pedido ideal para subir sem depender do caos da fila solo.',
    serviceType: 'soloqueue_boost',
    amount: 149,
    estimate: 'A partir de 24h',
    icon: Zap,
    featured: true,
    highlights: ['Rota por divisão', 'Booster especialista', 'Status do pedido'],
  },
  {
    id: 'duo-boost',
    title: 'Duo Boost',
    subtitle: 'Você joga junto com o booster',
    description: 'Para subir aprendendo call, macro e tomada de decisão durante as partidas.',
    serviceType: 'duo_boost',
    amount: 189,
    estimate: 'Agenda combinada',
    icon: Sparkles,
    highlights: ['Horário marcado', 'Call opcional', 'Ritmo seguro'],
  },
  {
    id: 'md-vitorias',
    title: 'Sprint de Vitórias',
    subtitle: 'Pacote para MD, PDL e sequência',
    description: 'Quando falta pouco para fechar o objetivo e você quer reduzir variância.',
    serviceType: 'wins_package',
    amount: 99,
    estimate: 'Entrega rápida',
    icon: CheckCircle,
    highlights: ['Foco em vitórias', 'Janela curta', 'Acompanhamento'],
  },
]

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value))
}

function formatPaymentMethod(method: PaymentTransaction['method']) {
  return method === 'pix' ? 'Pix' : 'Cartão'
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
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [creatingOrderKey, setCreatingOrderKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadPayments() {
      try {
        const nextPayments = await systemService.getPayments()

        if (active) {
          setPayments(nextPayments)
        }
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Histórico indisponível',
            description: getApiErrorMessage(error, 'Não foi possível carregar seus pedidos agora.'),
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

  async function handleCreateOrder(offer: PricingOffer, method: 'pix' | 'card') {
    const orderKey = `${offer.id}-${method}`
    const provider = method === 'pix' ? 'mercado_pago' : 'stripe'

    setCreatingOrderKey(orderKey)

    try {
      const { transaction } = await systemService.createCustomerPayment({
        service_type: offer.serviceType,
        title: offer.title,
        description: `${offer.description} ${offer.subtitle}.`,
        amount: offer.amount,
        provider,
        method,
      })

      setPayments((currentPayments) => [
        transaction,
        ...currentPayments.filter((payment) => payment.id !== transaction.id),
      ])

      addToast({
        tone: 'success',
        title: 'Pedido criado',
        description: `Seu pedido de ${offer.title} entrou como pendente. O próximo passo é finalizar o pagamento.`,
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Pedido não criado',
        description: getApiErrorMessage(error, 'Não conseguimos criar esse pedido. Tente novamente em instantes.'),
      })
    } finally {
      setCreatingOrderKey(null)
    }
  }

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="purchases-page">
        <section className="purchases-hero panel">
          <div className="purchases-hero__copy">
            <span className="panel__eyebrow">Área do cliente</span>
            <h1>Tabela de preços e pedidos.</h1>

            <div className="purchases-hero__actions">
              <a className="primary-button" href="#tabela-precos">
                Ver tabela
                <ArrowRight size={17} />
              </a>
              <a className="ghost-button" href="#meus-pedidos">
                Meus pedidos
              </a>
            </div>
          </div>

          <div className="purchases-hero__cards">
            <div className="mini-proof-card panel">
              <ShieldCheck size={18} />
              <strong>Conta de cliente</strong>
              <span>Sem acesso a saque, retirada ou ferramentas de booster.</span>
            </div>
            <div className="mini-proof-card panel">
              <ReceiptText size={18} />
              <strong>Pedido registrado</strong>
              <span>Cada compra cria histórico e transação pendente no painel.</span>
            </div>
          </div>
        </section>

        <section className="purchase-section" id="tabela-precos">
          <div className="section-heading">
            <span className="panel__eyebrow">Tabela de preços</span>
            <h2>Escolha o boost que encaixa com você</h2>
            <p>
              Valores iniciais para o cliente abrir pedido agora. Depois a gente pluga o
              checkout real do Mercado Pago/Stripe e regras finas por elo.
            </p>
          </div>

          <div className="pricing-grid">
            {pricingOffers.map((offer) => {
              const Icon = offer.icon
              const pixKey = `${offer.id}-pix`
              const cardKey = `${offer.id}-card`

              return (
                <article className={`price-card panel${offer.featured ? ' price-card--featured' : ''}`} key={offer.id}>
                  <div className="price-card__topline">
                    <div className="recommended-card__icon">
                      <Icon size={22} />
                    </div>
                    {offer.featured ? <span>Mais escolhido</span> : null}
                  </div>

                  <div>
                    <h3>{offer.title}</h3>
                    <p>{offer.subtitle}</p>
                  </div>

                  <strong className="price-card__price">{formatCurrency(offer.amount)}</strong>
                  <span className="price-card__estimate">
                    <Clock size={15} />
                    {offer.estimate}
                  </span>

                  <ul className="price-feature-list" aria-label={`Benefícios do ${offer.title}`}>
                    {offer.highlights.map((highlight) => (
                      <li key={highlight}>
                        <span />
                        {highlight}
                      </li>
                    ))}
                  </ul>

                  <div className="price-card__actions">
                    <button
                      className="primary-button"
                      disabled={creatingOrderKey !== null}
                      onClick={() => void handleCreateOrder(offer, 'pix')}
                      type="button"
                    >
                      {creatingOrderKey === pixKey ? <Loader2 className="spin-icon" size={16} /> : <ShoppingCart size={16} />}
                      Pedir no Pix
                    </button>
                    <button
                      className="ghost-button"
                      disabled={creatingOrderKey !== null}
                      onClick={() => void handleCreateOrder(offer, 'card')}
                      type="button"
                    >
                      {creatingOrderKey === cardKey ? <Loader2 className="spin-icon" size={16} /> : <CreditCard size={16} />}
                      Cartão
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="purchase-section purchases-content" id="meus-pedidos">
          <div className="section-heading">
            <span className="panel__eyebrow">Histórico do cliente</span>
            <h2>Meus pedidos</h2>
            <p>Pedidos criados pela tabela aparecem aqui com valor, método e status.</p>
          </div>

          {isLoadingPayments ? (
            <div className="empty-state">
              <Loader2 className="spin-icon" size={46} />
              <h3>Carregando pedidos</h3>
              <p>Estamos buscando seu histórico de compras.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={64} />
              <h3>Nenhum pedido ainda</h3>
              <p>Escolha um plano na tabela para criar seu primeiro pedido como cliente.</p>
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
        </section>
      </div>
    </AppShell>
  )
}
