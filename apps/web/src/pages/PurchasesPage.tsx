import {
  ArrowRight,
  CheckCircle,
  Clock,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Star,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { authService } from '@/services/auth'
import { useSessionStore } from '@/store/useSessionStore'

interface Purchase {
  id: number
  service: string
  status: 'completed' | 'in_progress'
  date: string
  amount: string
}

interface RecommendedOffer {
  title: string
  description: string
  icon: typeof Rocket
}

const mockPurchases: Purchase[] = [
  {
    id: 1,
    service: 'TFT Boost',
    status: 'completed',
    date: '2026-04-19',
    amount: 'R$ 50,00',
  },
  {
    id: 2,
    service: 'Wild Rift Boost',
    status: 'in_progress',
    date: '2026-04-18',
    amount: 'R$ 75,00',
  },
]

const recommendedOffers: RecommendedOffer[] = [
  {
    title: 'Combo Rank Up',
    description: 'Perfeito para quem quer sair do elo travado com prazo e acompanhamento.',
    icon: Rocket,
  },
  {
    title: 'Duo com Coach',
    description: 'Suba jogando junto e entenda as decisões que fazem você ganhar mais.',
    icon: Star,
  },
  {
    title: 'Sprint de Vitórias',
    description: 'Ideal para fechar MD, recuperar PDL ou aproveitar uma janela livre hoje.',
    icon: Zap,
  },
]

export function PurchasesPage() {
  const user = useSessionStore((state) => state.user)

  const handleLogout = async () => {
    await authService.logout()
  }

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="purchases-page">
        <section className="purchases-hero panel">
          <div className="purchases-hero__copy">
            <span className="panel__eyebrow">Área do cliente</span>
            <h1>Seu proximo rank pode comecar aqui.</h1>
            <p>
              Veja seus pedidos ativos, acompanhe entregas e escolha um novo plano
              quando quiser acelerar sua conta com segurança.
            </p>
            <div className="purchases-hero__actions">
              <Link className="primary-button" to="/">
                Comprar novo boost
                <ArrowRight size={17} />
              </Link>
              <Link className="ghost-button" to="/">
                Ver serviços
              </Link>
            </div>
          </div>

          <div className="purchases-hero__cards">
            <div className="mini-proof-card">
              <ShieldCheck size={18} />
              <strong>Seguro</strong>
              <span>Sem leitura de memória e com pedido rastreável.</span>
            </div>
            <div className="mini-proof-card">
              <Clock size={18} />
              <strong>Com prazo</strong>
              <span>Você sabe quando o serviço começa e como avança.</span>
            </div>
          </div>
        </section>

        <section className="purchase-section">
          <div className="section-heading">
            <span className="panel__eyebrow">Recomendado para você</span>
            <h2>Planos que combinam com seu histórico</h2>
            <p>
              Se você já comprou antes, vale aproveitar um plano maior para reduzir
              espera, organizar fila e subir com mais previsibilidade.
            </p>
          </div>

          <div className="recommended-grid">
            {recommendedOffers.map((offer) => {
              const Icon = offer.icon

              return (
                <article className="recommended-card panel" key={offer.title}>
                  <div className="recommended-card__header">
                    <div className="recommended-card__icon">
                      <Icon size={22} />
                    </div>
                  </div>
                  <h3>{offer.title}</h3>
                  <p>{offer.description}</p>
                  <Link className="service-cta" to="/">
                    Ver detalhes do plano
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="purchase-section purchases-content">
          <div className="section-heading">
            <span className="panel__eyebrow">Histórico</span>
            <h2>Minhas compras</h2>
            <p>Pedidos ativos e concluídos aparecem aqui para você não perder nada.</p>
          </div>

          {mockPurchases.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={64} />
              <h3>Nenhuma compra ainda</h3>
              <p>
                Comece com um plano simples e acompanhe tudo por aqui assim que o
                pedido for criado.
              </p>
              <Link className="primary-button" to="/">
                Comprar primeiro boost
              </Link>
            </div>
          ) : (
            <div className="purchases-list">
              {mockPurchases.map((purchase) => (
                <article key={purchase.id} className="purchase-card">
                  <div className="purchase-info">
                    <h4>{purchase.service}</h4>
                    <p>Data: {purchase.date}</p>
                    <p>Valor: {purchase.amount}</p>
                  </div>
                  <div className="purchase-status">
                    {purchase.status === 'completed' ? (
                      <div className="status-completed">
                        <CheckCircle size={20} />
                        <span>Concluído</span>
                      </div>
                    ) : (
                      <div className="status-progress">
                        <span className="status-dot" />
                        <span>Em andamento</span>
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
