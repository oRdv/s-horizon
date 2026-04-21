import { ChevronRight, MessageCircle, ShieldCheck, Star, Trophy, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'
import { useSessionStore } from '@/store/useSessionStore'

const discordUrl = 'https://discord.gg/cHPCH7BsrM'

const services = [
  {
    icon: Trophy,
    title: 'TFT Boost',
    description:
      'Pra subir no tabuleiro sem virar refém do meta da semana. Você define o elo, nós montamos a rota.',
    bullets: ['Rota por divisão', 'Booster especialista', 'Pedido acompanhado'],
  },
  {
    icon: Zap,
    title: 'Wild Rift Boost',
    description:
      'Boost mobile com horário combinado, ritmo claro e suporte para você não ficar perdido no processo.',
    bullets: ['Solo ou duo', 'Janela combinada', 'Suporte durante o pedido'],
  },
  {
    icon: Users,
    title: 'Flex Boost',
    description:
      'Fila flex organizada para quem quer resultado sem depender do caos do matchmaking.',
    bullets: ['Foco em vitórias', 'Ritmo de fila', 'Progresso rastreável'],
  },
  {
    icon: Star,
    title: 'Soloqueue Boost',
    description:
      'Seu rank desejado com planejamento, execução segura e visão clara do que está acontecendo.',
    bullets: ['Plano personalizado', 'Ranks altos', 'Histórico transparente'],
  },
]

const steps = [
  'Você chama no Discord e manda elo atual, objetivo e preferência de horário.',
  'A Horizon monta uma rota de boost com prazo, fila e forma de acompanhamento.',
  'O pedido avança com status claro até o GG final, sem sumiço e sem promessa vaga.',
]

export function LandingPage() {
  const user = useSessionStore((state) => state.user)

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
          <a className="discord-button discord-button--header" href={discordUrl} rel="noreferrer" target="_blank">
            <MessageCircle size={18} />
            Discord
          </a>
          {user ? (
            <Link to="/login" className="landing-signup-btn">
              Login
            </Link>
          ) : (
            <>
              <Link to="/login" className="landing-login-btn">
                Entrar
              </Link>
              <Link to="/signup" className="landing-signup-btn">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-content">
            <span className="hero-badge">
              <ShieldCheck size={16} />
              Boost seguro, suporte humano e pedido rastreável
            </span>
            <h1 className="hero-title">
              Suba de elo com um plano claro,
              <span className="hero-highlight"> não com promessa solta.</span>
            </h1>
            <p className="hero-subtitle">
              A Horizon Boost organiza seu boost do briefing ao GG final: rota definida,
              prazo combinado, acompanhamento pelo painel e atendimento direto no Discord.
            </p>

            <div className="hero-actions">
              <a className="cta-button cta-button--primary cta-button--discord" href={discordUrl} rel="noreferrer" target="_blank">
                <MessageCircle size={20} />
                Entrar no Discord
              </a>
              <a className="cta-button cta-button--ghost" href="#servicos">
                Ver boosts
                <ChevronRight size={18} />
              </a>
            </div>
          </div>

          <aside className="discord-panel" aria-label="Atendimento no Discord">
            <div className="discord-panel__topline">
              <span className="live-dot" />
              Atendimento aberto
            </div>
            <h2>Quer orçamento sem enrolação?</h2>
            <p>
              Entra no Discord, manda seu elo atual e o objetivo. A gente te responde
              com uma rota simples de entender antes de você fechar qualquer coisa.
            </p>
            <div className="discord-panel__perks">
              <span>Briefing rápido</span>
              <span>Status do pedido</span>
              <span>Suporte humano</span>
            </div>
            <a className="discord-button discord-button--panel" href={discordUrl} rel="noreferrer" target="_blank">
              <MessageCircle size={19} />
              Abrir Discord agora
            </a>
          </aside>
        </section>

        <section className="services-section" id="servicos">
          <div className="section-heading">
            <span>Planos de boost</span>
            <h2 className="section-title">Escolha o boost que encaixa com você</h2>
            <p className="section-subtitle">
              Seja TFT, Wild Rift, Flex ou Soloqueue, a ideia é simples: menos fila
              frustrante, mais clareza e um caminho real até o próximo marco.
            </p>
          </div>

          <div className="services-grid">
            {services.map((service) => {
              const Icon = service.icon

              return (
                <article className="service-card service-card--sales" key={service.title}>
                  <div className="service-icon">
                    <Icon size={30} />
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
                  <a className="service-cta" href={discordUrl} rel="noreferrer" target="_blank">
                    Quero esse plano
                    <ChevronRight size={17} />
                  </a>
                </article>
              )
            })}
          </div>
        </section>

        <section className="company-section">
          <div className="section-heading">
            <span>Como funciona</span>
            <h2 className="section-title">Do chamado ao GG final</h2>
            <p className="section-subtitle">
              Nada de pedido jogado no escuro. Você sabe o que foi combinado, onde o
              boost está e qual é o próximo passo.
            </p>
          </div>
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
          <div>
            <span className="cta-section__eyebrow">Sem formulário gigante</span>
            <h2>Seu boost começa com uma conversa rápida.</h2>
            <p>
              Chama no Discord, passa o elo e recebe uma rota objetiva. Se fizer sentido,
              a gente segue com o pedido; se não fizer, você sai com a resposta do mesmo jeito.
            </p>
          </div>
          <a className="cta-button cta-button--primary cta-button--discord" href={discordUrl} rel="noreferrer" target="_blank">
            <MessageCircle size={20} />
            Falar com a Horizon
          </a>
        </section>

        <section className="booster-recruit-section">
          <div className="booster-recruit-card">
            <div>
              <span className="cta-section__eyebrow">Área dos boosters</span>
              <h2>Joga bem e quer ganhar com isso?</h2>
              <p>
                Envie sua inscrição para entrar na fila de análise da Horizon. A gente
                revisa rank, disponibilidade, OP.GG e dados de pagamento antes de liberar
                o acesso como booster.
              </p>
            </div>

            <div className="booster-recruit-list">
              <span>Análise pela administração</span>
              <span>Ficha com OP.GG, Discord e horários</span>
              <span>Pagamentos via Pix e porcentagem inicial</span>
            </div>

            <Link className="cta-button cta-button--primary booster-recruit-button" to="/booster/apply">
              Ser booster
              <ChevronRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <BrandMark />
            <p>(c) 2026 Horizon Boost. Todos os direitos reservados.</p>
          </div>
          <div className="footer-links">
            {services.map((service) => (
              <div className="footer-column" key={service.title}>
                <h5>{service.title.replace(' Boost', '')}</h5>
                <ul>
                  <li>
                    <a href={discordUrl} rel="noreferrer" target="_blank">
                      Orçamento
                    </a>
                  </li>
                  <li>
                    <a href={discordUrl} rel="noreferrer" target="_blank">
                      Falar no Discord
                    </a>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
