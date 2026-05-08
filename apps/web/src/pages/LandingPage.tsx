import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck, MessageCircle, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'
import { getLolChampionOptions, type LolChampionOption } from '@/services/riot'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import type { LandingBooster } from '@/types/system'

const discordUrl = 'https://discord.gg/cHPCH7BsrM'

const services = [
  {
    icon: Trophy,
    title: 'Solo/Duo Boost',
    description: 'Subida por elo com rota definida, prazo estimado e adicionais claros antes do pagamento.',
    bullets: ['Rota por divisão', 'Preferências de campeões', 'Acompanhamento pelo painel'],
  },
  {
    icon: Sparkles,
    title: 'Duo Boost',
    description: 'Você joga junto com o booster e mantém controle sobre horários, rota e ritmo do serviço.',
    bullets: ['Partidas acompanhadas', 'Janela combinada', 'Comunicação direta'],
  },
  {
    icon: ClipboardCheck,
    title: 'Vitórias e MD5',
    description: 'Pacotes objetivos para resolver séries, MD5 ou metas pontuais sem montar uma rota completa.',
    bullets: ['Preço por pacote', 'Execução rápida', 'Resumo do pedido'],
  },
  {
    icon: Users,
    title: 'Coaching',
    description: 'Sessões por hora para revisar decisões, mapa, rota, macro e pontos que travam sua evolução.',
    bullets: ['Review de gameplay', 'Plano de melhoria', 'Foco no seu elo'],
  },
]

const steps = [
  'Monte a rota no painel ou fale com a equipe no Discord.',
  'Revise o valor, os adicionais e as regras antes de confirmar.',
  'Acompanhe o pedido com status, pagamento e histórico centralizados.',
]

const rankEmblems = {
  iron: '/ranks/iron.png',
  bronze: '/ranks/bronze.png',
  silver: '/ranks/silver.png',
  gold: '/ranks/gold.png',
  platinum: '/ranks/platinum.png',
  emerald: '/ranks/emerald.png',
  diamond: '/ranks/diamond.png',
  master: '/ranks/master.png',
  grandmaster: '/ranks/grandmaster.png',
  challenger: '/ranks/challenger.png',
} as const

export function LandingPage() {
  const user = useSessionStore((state) => state.user)
  const [champions, setChampions] = useState<LolChampionOption[]>([])
  const [landingBoosters, setLandingBoosters] = useState<LandingBooster[]>([])

  useEffect(() => {
    let active = true

    void getLolChampionOptions()
      .then((options) => {
        if (active) {
          setChampions(options)
        }
      })
      .catch(() => undefined)

    void systemService
      .getPublicLandingBoosters()
      .then((boosters) => {
        if (active) {
          setLandingBoosters(boosters)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const championByName = useMemo(() => {
    return new Map(champions.map((champion) => [champion.name.toLowerCase(), champion]))
  }, [champions])

  const boosterSlides = useMemo(() => {
    return [...landingBoosters, ...landingBoosters]
  }, [landingBoosters])

  return (
    <div className="landing-page">
      <div className="landing-background" aria-hidden="true">
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
            <Link to="/dashboard" className="landing-signup-btn">
              Abrir painel
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
              Boost com pedido claro e acompanhamento real
            </span>
            <h1 className="hero-title">Horizon Boost para quem quer subir de elo com controle do pedido.</h1>
            <p className="hero-subtitle">
              Monte sua rota, escolha adicionais, veja o valor final antes do pagamento e acompanhe tudo pelo painel.
              Quando precisar de ajuda, a equipe responde no Discord.
            </p>

            <div className="hero-actions">
              <Link className="cta-button cta-button--primary" to={user ? '/purchases' : '/signup'}>
                Montar meu pedido
                <ChevronRight size={18} />
              </Link>
              <a className="cta-button cta-button--ghost" href={discordUrl} rel="noreferrer" target="_blank">
                <MessageCircle size={18} />
                Falar no Discord
              </a>
            </div>
          </div>

          <aside className="discord-panel" aria-label="Resumo do atendimento">
            <div className="discord-panel__topline">
              <span className="live-dot" />
              Atendimento ativo
            </div>
            <h2>Sem pedido no escuro.</h2>
            <p>
              A ideia é simples: você entende a rota, o prazo e o custo antes de seguir. O painel organiza o pedido; o
              Discord resolve dúvidas e ajustes.
            </p>
            <div className="discord-panel__perks">
              <span>Valor final visível</span>
              <span>Preferências configuráveis</span>
              <span>Histórico do cliente</span>
            </div>
            <Link className="discord-button discord-button--panel" to={user ? '/purchases' : '/signup'}>
              Abrir tabela de preços
            </Link>
          </aside>
        </section>

        <section className="boosters-section" aria-labelledby="boosters-title">
          <div className="section-heading">
            <span>Equipe Horizon</span>
            <h2 className="section-title" id="boosters-title">
              Boosters prontos para assumir sua rota
            </h2>
          </div>

          <div className="boosters-slider" aria-label="Slider automático de boosters">
            <div className="boosters-slider__track">
              {boosterSlides.map((booster, index) => {
                const champion = championByName.get(booster.champion_name.toLowerCase())

                return (
                  <article className="booster-card" key={`${booster.id}-${index}`}>
                    <div className="booster-card__portrait">
                      {champion ? <img alt="" src={champion.iconUrl} /> : <span>{booster.nick.slice(0, 2)}</span>}
                    </div>

                    <div className="booster-card__content">
                      <div>
                        <span className="booster-card__eyebrow">{booster.game}</span>
                        <h3>{booster.nick}</h3>
                      </div>

                      <div className="booster-card__rank">
                        <img alt="" src={rankEmblems[booster.rank_key]} />
                        <span>{booster.rank_label}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="services-section" id="servicos">
          <div className="section-heading">
            <span>Serviços</span>
            <h2 className="section-title">Escolha o formato certo para sua meta</h2>
            <p className="section-subtitle">
              O foco da Horizon é deixar o pedido legível: o que será feito, quanto custa, quais adicionais entram e
              como você acompanha o andamento.
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
                  <Link className="service-cta" to={user ? '/purchases' : '/signup'}>
                    Ver preços
                    <ChevronRight size={17} />
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="company-section">
          <div className="section-heading">
            <span>Como funciona</span>
            <h2 className="section-title">Do cálculo ao acompanhamento</h2>
            <p className="section-subtitle">
              Você não precisa adivinhar o preço nem depender de conversa solta para saber o que está comprando.
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
            <span className="cta-section__eyebrow">Pronto para começar?</span>
            <h2>Monte um pedido com preço claro e acompanhamento pelo painel.</h2>
            <p>
              Crie sua conta para simular rotas, adicionar preferências e seguir para o pagamento quando fizer sentido.
            </p>
          </div>
          <Link className="cta-button cta-button--primary" to={user ? '/purchases' : '/signup'}>
            Começar agora
            <ChevronRight size={18} />
          </Link>
        </section>

        <section className="booster-recruit-section">
          <div className="booster-recruit-card">
            <div>
              <span className="cta-section__eyebrow">Área dos boosters</span>
              <h2>Joga bem e quer trabalhar com a Horizon?</h2>
              <p>
                Envie sua inscrição para análise. A equipe revisa dados de conta, disponibilidade, OP.GG, Discord e
                informações de pagamento antes de liberar o acesso.
              </p>
            </div>

            <div className="booster-recruit-list">
              <span>Análise pela administração</span>
              <span>Ficha com OP.GG, Discord e horários</span>
              <span>Pagamentos via Pix e percentual inicial</span>
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
            <p>© 2026 Horizon Boost. Todos os direitos reservados.</p>
          </div>
          <div className="footer-links">
            {services.map((service) => (
              <div className="footer-column" key={service.title}>
                <h5>{service.title}</h5>
                <ul>
                  <li>
                    <Link to={user ? '/purchases' : '/signup'}>Tabela de preços</Link>
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
