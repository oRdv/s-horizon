import { Rocket, Star, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { useSessionStore } from '@/store/useSessionStore'

const services = [
  {
    icon: Rocket,
    title: 'TFT Boost',
    description:
      'Suba no Teamfight Tactics com um pedido organizado por elo, prazo e objetivo.',
    bullets: ['Plano por divisão', 'Booster especialista', 'Acompanhamento do pedido'],
  },
  {
    icon: Zap,
    title: 'Wild Rift Boost',
    description:
      'Acelere sua conta mobile com execução segura, horário combinado e suporte.',
    bullets: ['Solo ou duo', 'Horário combinado', 'Suporte durante o pedido'],
  },
  {
    icon: Users,
    title: 'Flex Boost',
    description:
      'Organize sua fila flex com consistência, foco em vitórias e progresso rastreável.',
    bullets: ['Foco em vitórias', 'Macro e ritmo', 'Pedido acompanhado'],
  },
  {
    icon: Star,
    title: 'Soloqueue Boost',
    description:
      'Ideal para quem quer chegar no rank desejado sem perder tempo em tentativas soltas.',
    bullets: ['Boost personalizado', 'Ranks altos', 'Histórico transparente'],
  },
]

const steps = [
  'Escolha o serviço e diga seu elo atual.',
  'Receba um plano com prazo, valor e próxima janela.',
  'Acompanhe cada etapa pelo painel Horizon Boost.',
]

export function LandingPage() {
  const user = useSessionStore((state) => state.user)
  const primaryCtaHref = user ? '/purchases' : '/signup'
  const primaryCtaLabel = user ? 'Ver planos recomendados' : 'Quero meu boost'

  return (
    <div className="landing-page">
      <div className="landing-background" aria-hidden="true">
        <div className="visual-orb visual-orb--one" />
        <div className="visual-orb visual-orb--two" />
        <div className="visual-orb visual-orb--three" />
        <div className="visual-grid" />
      </div>

      <header className="landing-header">
        <div className="landing-header__brand">
          <BrandMark />
        </div>
        <div className="landing-header__actions">
          <ThemeSwitch />
          {user ? (
            <Link to="/purchases" className="landing-signup-btn">
              Meu painel
            </Link>
          ) : (
            <>
              <Link to="/login" className="landing-login-btn">
                Entrar
              </Link>
              <Link to="/signup" className="landing-signup-btn">
                Criar Conta
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              Pare de perder tempo preso no mesmo elo.
              <span className="hero-highlight"> A Horizon Boost te leva mais longe.</span>
            </h1>
            <p className="hero-subtitle">
              Contrate boosters verificados, acompanhe o andamento em tempo real e receba
              suporte humano do pedido até a entrega.
            </p>

            <div className="hero-actions">
              <Link to={primaryCtaHref} className="cta-button cta-button--primary">
                {primaryCtaLabel}
              </Link>
              <Link to={user ? '/purchases' : '/login'} className="cta-button cta-button--ghost">
                {user ? 'Abrir minha área' : 'Já tenho conta'}
              </Link>
            </div>

          </div>
        </section>

        <section className="services-section">
          <h2 className="section-title">Escolha o boost que encaixa com você</h2>
          <p className="section-subtitle">
            Do primeiro PDL até a próxima divisão, você escolhe o objetivo e acompanha
            tudo com clareza, prazo combinado e suporte durante o pedido.
          </p>

          <div className="services-grid">
            {services.map((service) => {
              const Icon = service.icon

              return (
                <article className="service-card service-card--sales" key={service.title}>
                  <div className="service-icon">
                    <Icon size={32} />
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <ul className="service-benefits">
                    {service.bullets.map((bullet) => (
                      <li key={bullet}>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={primaryCtaHref} className="service-cta">
                    Quero esse plano
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="company-section">
          <h2 className="section-title">Como funciona</h2>
          <div className="steps-grid">
            {steps.map((step, index) => (
              <article className="step-card" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-section">
          <h2>Crie sua conta e receba um plano de boost hoje.</h2>
          <p>
            Quanto antes você inicia, mais cedo acompanha seu progresso pelo painel.
            A compra fica organizada, rastreável e com suporte perto.
          </p>
          <Link to={primaryCtaHref} className="cta-button cta-button--primary">
            {user ? 'Abrir planos recomendados' : 'Criar conta e pedir orçamento'}
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <BrandMark />
            <p>(c) 2026 Horizon Boost. Todos os direitos reservados.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h5>TFT</h5>
              <ul>
                <li>
                  <Link to={primaryCtaHref}>Elojob</Link>
                </li>
                <li>
                  <Link to={primaryCtaHref}>Coaching</Link>
                </li>
              </ul>
            </div>
            <div className="footer-column">
              <h5>Wild Rift</h5>
              <ul>
                <li>
                  <Link to={primaryCtaHref}>Elojob</Link>
                </li>
                <li>
                  <Link to={primaryCtaHref}>Duo Boost</Link>
                </li>
              </ul>
            </div>
            <div className="footer-column">
              <h5>Flex</h5>
              <ul>
                <li>
                  <Link to={primaryCtaHref}>Boosting</Link>
                </li>
                <li>
                  <Link to={primaryCtaHref}>Vitórias</Link>
                </li>
              </ul>
            </div>
            <div className="footer-column">
              <h5>Soloqueue</h5>
              <ul>
                <li>
                  <Link to={primaryCtaHref}>Ranked</Link>
                </li>
                <li>
                  <Link to={primaryCtaHref}>Placement</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
