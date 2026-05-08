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
    description: 'Quer subir de elo sem ficar preso no mesmo lugar? A gente combina a rota e toca o serviço com você.',
    bullets: ['Elo de saída e chegada', 'Campeões preferidos', 'Status no painel'],
  },
  {
    icon: Sparkles,
    title: 'Duo Boost',
    description: 'Você joga junto, aprende no caminho e combina os horários direto com quem vai te acompanhar.',
    bullets: ['Partidas em duo', 'Horário combinado', 'Contato direto'],
  },
  {
    icon: ClipboardCheck,
    title: 'Vitórias e MD5',
    description: 'Para quando falta pouco: fechar série, passar MD5 ou garantir algumas vitórias sem montar rota grande.',
    bullets: ['Pacotes fechados', 'Pedido mais rápido', 'Tudo registrado'],
  },
  {
    icon: Users,
    title: 'Coaching',
    description: 'Uma revisão honesta do seu jogo: o que está funcionando, o que está te segurando e como corrigir.',
    bullets: ['Review de partida', 'Dicas práticas', 'Foco no seu elo'],
  },
]

const steps = [
  'Escolha o serviço e coloque seu elo atual e o elo que quer buscar.',
  'Veja o valor, tire qualquer dúvida no Discord e confirme só quando estiver tranquilo.',
  'Depois acompanhe pelo painel, sem ficar caçando conversa antiga.',
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
              Boost sem conversa torta
            </span>
            <h1 className="hero-title">Suba de elo sem perder tempo no mesmo lugar.</h1>
            <p className="hero-subtitle">
              Personalize sua jornada de boost de forma dinâmica e simplificada, acompanhando tudo pelo nosso
              dashboard. Caso tenha alguma dúvida, nossa equipe está disponível 24 horas no Discord.
            </p>

            <div className="hero-actions">
              <Link className="cta-button cta-button--primary" to={user ? '/purchases' : '/signup'}>
                Quero subir de elo
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
            <h2>Aqui seu investimento é valorizado.</h2>
            <p>
              Faça seu orçamento de.
            </p>
            <div className="discord-panel__perks">
              <span>Preço antes de pagar</span>
              <span>Preferências salvas</span>
              <span>Pedido organizado</span>
            </div>
            <Link className="discord-button discord-button--panel" to={user ? '/purchases' : '/signup'}>
              Ver valores
            </Link>
          </aside>
        </section>

        <section className="boosters-section" aria-labelledby="boosters-title">
          <div className="section-heading">
            <span>Quem joga com a gente</span>
            <h2 className="section-title" id="boosters-title">
              Boosters prontos para entrar em ação
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
            <h2 className="section-title">Escolha o que faz sentido pra você</h2>
            <p className="section-subtitle">
              Tem pedido pra subir de elo, jogar duo, fechar vitória e até revisar gameplay. Você monta do seu jeito e
              já vê quanto vai ficar.
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
                    Ver valores
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
            <h2 className="section-title">Simples, sem ficar indo e voltando</h2>
            <p className="section-subtitle">
              Nada de ficar perguntando preço no privado e esperando alguém montar tudo manualmente. O básico já fica
              na sua frente.
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
            <h2>Monte seu pedido e veja na hora quanto fica.</h2>
            <p>
              Crie sua conta, simule a rota, coloque suas preferências e siga só quando estiver tudo certo pra você.
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
              <h2>Joga bem e quer pegar serviço com a Horizon?</h2>
              <p>
                Manda sua inscrição pra análise. A gente olha conta, disponibilidade, OP.GG, Discord e dados de
                pagamento antes de liberar o acesso.
              </p>
            </div>

            <div className="booster-recruit-list">
              <span>Análise da equipe</span>
              <span>OP.GG, Discord e horários</span>
              <span>Pagamentos via Pix e percentual inicial</span>
            </div>

            <Link className="cta-button cta-button--primary booster-recruit-button" to="/booster/apply">
              Quero ser booster
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
                    <Link to={user ? '/purchases' : '/signup'}>Ver valores</Link>
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
