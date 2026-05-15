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
    title: 'EloBoost',
    description: 'Escolha sua rota e selecione seus campeões, nós jogamos para você',
    bullets: ['rota principal', 'campeões preferidos', 'status no painel'],
  },
  {
    icon: Sparkles,
    title: 'DuoBoost',
    description: 'Você joga junto, aprende no caminho e combina os horários direto com quem vai te acompanhar.',
    bullets: ['partidas em duo', 'horário combinado', 'contato direto'],
  },
  {
    icon: ClipboardCheck,
    title: 'Vitórias e MD5',
    description: 'Para quando falta pouco: garantir a MD5 ou aquelas vitórias pro elo desejado.',
    bullets: ['pacotes fechados', 'pedido mais rápido', 'tudo registrado'],
  },
  {
    icon: Users,
    title: 'Coaching',
    description: 'Aprenda com os melhores',
    bullets: ['review de partida', 'dicas práticas', 'foco no seu elo'],
  },
]

const steps = [
  'Selecione o serviço, informe seu elo atual e defina o elo que deseja alcançar.',
  'Consulte o valor, esclareça qualquer dúvida pelo Discord e confirme apenas quando tiver certeza.',
  'Após a confirmação, acompanhe todo o progresso pelo painel.',
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
              Alcance o elo que você merece.
            </span>
            <h1 className="hero-title">Descubra o seu verdadeiro potencial
Eloboost com rapidez e qualidade.</h1>
            <p className="hero-subtitle">
             Personalize sua experiência com eloboost de forma prática e intuitiva, acompanhando cada etapa pelo nosso dashboard e com suporte disponível 24 horas através do Discord.

            </p>

            <div className="hero-actions">
              <Link className="cta-button cta-button--primary" to={user ? '/purchases' : '/signup'}>
                Quero subir de elo
                <ChevronRight size={18} />
              </Link>
              <a className="cta-button cta-button--ghost" href={discordUrl} rel="noreferrer" target="_blank">
                <MessageCircle size={18} />
                Suporte
              </a>
            </div>
          </div>

          <aside className="discord-panel" aria-label="Resumo do atendimento">
            <div className="discord-panel__topline">
              <span className="live-dot" />
              Atendimento ativo
            </div>
            <h2>Qualidade, confiança e resultado em primeiro lugar.</h2>
            <p>Faça seu orçamento com:</p>
            <div className="discord-panel__perks">
              <span>Transparência</span>
              <span>Segurança</span>
              <span>Organização</span>
            </div>
            <Link className="discord-button discord-button--panel" to={user ? '/purchases' : '/signup'}>
              Ver valores
            </Link>
          </aside>
        </section>

        <section className="boosters-section" aria-labelledby="boosters-title">
          <div className="section-heading">
            <span>NOSSOS BOOSTERS</span>
            <h2 className="section-title" id="boosters-title">
              Nossa equipe é formada pelos melhores jogadores, com experiência e capacidade. Conheça nossos jogadores:
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
            <span>SERVIÇOS</span>
            <h2 className="section-title">Escolha a opção ideal para você</h2>
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
            <span>COMO FUNCIONA</span>
            <h2 className="section-title">
              Simples e direto. Sem precisar solicitar valores ou aguardar atendimento. As principais informações ficam
              disponíveis de forma clara e imediata para você.
            </h2>
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
            <span className="cta-section__eyebrow">PRONTO PARA COMEÇAR?</span>
            <h2>Monte seu pedido e veja o valor instantaneamente.</h2>
            <p>Crie sua conta, simule a rota, personalize suas preferências e prossiga.</p>
          </div>
          <Link className="cta-button cta-button--primary" to={user ? '/purchases' : '/signup'}>
            Começar agora
            <ChevronRight size={18} />
          </Link>
        </section>

        <section className="booster-recruit-section">
          <div className="booster-recruit-card">
            <div>
              <span className="cta-section__eyebrow">SEJA BOOSTER</span>
              <h2>Faça parte da equipe de boosters da Horizon.</h2>
              <p>
                Envie sua inscrição para análise. Avaliamos disponibilidade, OP.GG, Discord e informações necessárias
                antes da aprovação.
              </p>
            </div>

            <div className="booster-recruit-list">
              <span>gameplay</span>
              <span>disponibilidade</span>
              <span>porcentagem inicial</span>
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
