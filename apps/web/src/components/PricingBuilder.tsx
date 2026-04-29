import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CreditCard,
  Gamepad2,
  Headphones,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Sword,
  Target,
  TimerReset,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

import {
  createBoostQuote,
  createUnitQuote,
  formatTierDivision,
  formatTierSubtitle,
  gameCatalog,
  getGameLabel,
  getGameTiers,
  getFixedPriceValue,
  getModeMeta,
  getPriceRow,
  isApexTier,
  priceTable,
  rankDivisions,
  type GameKey,
  type PriceMode,
  type RankDivision,
  type RankTier,
} from '@/data/pricing'
import { getApiErrorMessage } from '@/services/api/errors'
import { getLolChampionOptions, type LolChampionOption } from '@/services/riot'
import { systemService } from '@/services/system'
import { useToastStore } from '@/store/useToastStore'
import type { PaymentTransaction, ServiceOrder } from '@/types/system'

interface PricingBuilderProps {
  variant?: 'page' | 'dashboard'
  canCheckout?: boolean
  showReferenceTable?: boolean
  eyebrow?: string
  title?: string
  description?: string
  onOrderCreated?: (payload: { transaction: PaymentTransaction; order: ServiceOrder }) => void
}

type ServiceFamily = 'boost' | 'packages' | 'coaching'
type MmrProfile = 'none' | 'nerfed' | 'buffed'
type FlashSlot = 'D' | 'F'

interface ModeCard {
  mode: PriceMode
  label: string
  helper: string
  icon: LucideIcon
}

interface FamilyCard {
  family: ServiceFamily
  label: string
  helper: string
  icon: LucideIcon
  modes: PriceMode[]
}

interface GameCard {
  game: GameKey
  label: string
  helper: string
}

interface StepItem {
  index: string
  title: string
  helper: string
}

interface AddonState {
  mmrProfile: MmrProfile
  chatOffline: boolean
  flashPositionEnabled: boolean
  flashPosition: FlashSlot
  routesEnabled: boolean
  specificRoutes: string[]
  priorityService: boolean
  favoriteBooster: boolean
  favoriteBoosterNote: string
  superRestriction: boolean
  extraWin: boolean
  championPoolEnabled: boolean
  specificChampions: string[]
  restrictedHours: boolean
  restrictedHoursNote: string
  streamOnline: boolean
  reduceKda: boolean
  reduceDelivery: boolean
  soloOnly: boolean
}

const gameCards: GameCard[] = [
  {
    game: 'lol',
    label: 'League of Legends',
    helper: 'Solo/Duo com tiers atuais do LoL.',
  },
  {
    game: 'wild_rift',
    label: 'Wild Rift',
    helper: 'Fila mobile com Soberano no topo.',
  },
  {
    game: 'tft',
    label: 'TFT',
    helper: 'Rotas baseadas na ladder do Teamfight Tactics.',
  },
]

const modeCards: ModeCard[] = [
  {
    mode: 'solo',
    label: 'Solo Boost',
    helper: 'Subida completa por rota de divisoes.',
    icon: Sword,
  },
  {
    mode: 'duo',
    label: 'Duo Boost',
    helper: 'Voce joga junto e a rota segue por etapa.',
    icon: Sparkles,
  },
  {
    mode: 'wins',
    label: 'Wins',
    helper: 'Vitorias avulsas para objetivo rapido.',
    icon: Target,
  },
  {
    mode: 'md5',
    label: 'MD5',
    helper: 'Pacote fechado de cinco partidas.',
    icon: TimerReset,
  },
  {
    mode: 'coaching',
    label: 'Coaching',
    helper: 'Sessao por hora com foco em gameplay.',
    icon: Headphones,
  },
]

const familyCards: FamilyCard[] = [
  {
    family: 'boost',
    label: 'Boost por elo',
    helper: 'Subida completa entre dois pontos da ranked.',
    icon: TrendingUp,
    modes: ['solo', 'duo'],
  },
  {
    family: 'packages',
    label: 'Pacotes rapidos',
    helper: 'Wins e MD5 para resolver algo pontual.',
    icon: TimerReset,
    modes: ['wins', 'md5'],
  },
  {
    family: 'coaching',
    label: 'Coaching',
    helper: 'Review, macro, mapa e leitura de jogo.',
    icon: Headphones,
    modes: ['coaching'],
  },
]

const divisionSteps: StepItem[] = [
  {
    index: '1',
    title: 'Servico',
    helper: 'Escolha a base',
  },
  {
    index: '2',
    title: 'Elo inicial',
    helper: 'Ponto de partida',
  },
  {
    index: '3',
    title: 'Elo final',
    helper: 'Destino da rota',
  },
  {
    index: '4',
    title: 'Adicionais',
    helper: 'Personalize o pedido',
  },
  {
    index: '5',
    title: 'Pagamento',
    helper: 'Feche o checkout',
  },
]

const defaultSteps: StepItem[] = [
  {
    index: '1',
    title: 'Servico',
    helper: 'Escolha a base',
  },
  {
    index: '2',
    title: 'Base',
    helper: 'Defina o elo',
  },
  {
    index: '3',
    title: 'Quantidade',
    helper: 'Ajuste o volume',
  },
  {
    index: '4',
    title: 'Pagamento',
    helper: 'Feche o checkout',
  },
]

const quantityLabels: Record<Extract<PriceMode, 'wins' | 'md5' | 'coaching'>, string> = {
  wins: 'Quantidade de vitorias',
  md5: 'Quantidade de pacotes',
  coaching: 'Quantidade de horas',
}

const routeOptionsByGame: Record<GameKey, string[]> = {
  lol: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
  wild_rift: ['Baron', 'Jungle', 'Mid', 'Dragon', 'Support'],
  tft: [],
}

function createInitialAddons(): AddonState {
  return {
    mmrProfile: 'none',
    chatOffline: false,
    flashPositionEnabled: false,
    flashPosition: 'D',
    routesEnabled: false,
    specificRoutes: [],
    priorityService: false,
    favoriteBooster: false,
    favoriteBoosterNote: '',
    superRestriction: false,
    extraWin: false,
    championPoolEnabled: false,
    specificChampions: [],
    restrictedHours: false,
    restrictedHoursNote: '',
    streamOnline: false,
    reduceKda: false,
    reduceDelivery: false,
    soloOnly: false,
  }
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function getReferenceRange(mode: PriceMode, tier: RankTier) {
  const row = getPriceRow(tier)

  if (mode === 'solo') {
    return row.solo
  }

  if (mode === 'duo') {
    return row.duo
  }

  if (mode === 'wins') {
    return row.wins
  }

  if (mode === 'md5') {
    return row.md5Package
  }

  return row.coaching
}

function getFamilyForMode(mode: PriceMode): ServiceFamily {
  if (mode === 'solo' || mode === 'duo') {
    return 'boost'
  }

  if (mode === 'wins' || mode === 'md5') {
    return 'packages'
  }

  return 'coaching'
}

function clampQuantity(quantity: number) {
  return Math.max(1, Math.min(10, Math.floor(quantity || 1)))
}

function getDefaultCurrentTier(game: GameKey): RankTier {
  return getGameTiers(game).includes('silver') ? 'silver' : getGameTiers(game)[0]
}

function getDefaultTargetTier(game: GameKey): RankTier {
  return getGameTiers(game).includes('gold') ? 'gold' : getGameTiers(game)[1] ?? getGameTiers(game)[0]
}

function ToggleAddonCard(props: {
  active: boolean
  badge: string
  helper: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={props.active}
      className={`pricing-addon-card${props.active ? ' is-active' : ''}`}
      onClick={props.onClick}
      type="button"
    >
      <div className="pricing-addon-card__top">
        <strong>{props.label}</strong>
        <span>{props.badge}</span>
      </div>
      <small>{props.helper}</small>
    </button>
  )
}

export function PricingBuilder({
  variant = 'page',
  canCheckout = true,
  showReferenceTable = variant === 'page',
  eyebrow = 'Tabela de precos',
  title = 'Escolha o servico e monte sua rota',
  description = 'Escolha o jogo, ajuste o elo atual e o destino final. A Horizon recalcula tudo na hora com a ladder correta de cada fila.',
  onOrderCreated,
}: PricingBuilderProps) {
  const addToast = useToastStore((state) => state.addToast)
  const [game, setGame] = useState<GameKey>('lol')
  const [mode, setMode] = useState<PriceMode>('solo')
  const [currentTier, setCurrentTier] = useState<RankTier>('silver')
  const [currentDivision, setCurrentDivision] = useState<RankDivision>('IV')
  const [targetTier, setTargetTier] = useState<RankTier>('gold')
  const [targetDivision, setTargetDivision] = useState<RankDivision>('IV')
  const [unitTier, setUnitTier] = useState<RankTier>('silver')
  const [quantity, setQuantity] = useState(1)
  const [addons, setAddons] = useState<AddonState>(() => createInitialAddons())
  const [championQuery, setChampionQuery] = useState('')
  const [championOptions, setChampionOptions] = useState<LolChampionOption[]>([])
  const [isLoadingChampions, setIsLoadingChampions] = useState(true)
  const [creatingMethod, setCreatingMethod] = useState<'pix' | 'card' | null>(null)

  const activeFamily = getFamilyForMode(mode)
  const familyMeta = familyCards.find((card) => card.family === activeFamily) ?? familyCards[0]
  const visibleModeCards = modeCards.filter((card) => familyMeta.modes.includes(card.mode))
  const modeMeta = getModeMeta(mode)
  const gameMeta = gameCatalog[game]
  const gameTiers = useMemo(() => getGameTiers(game), [game])
  const isDivisionMode = activeFamily === 'boost'
  const builderSteps = isDivisionMode ? divisionSteps : defaultSteps
  const quote = isDivisionMode
    ? createBoostQuote({
        mode: mode as Extract<PriceMode, 'solo' | 'duo'>,
        currentTier,
        currentDivision,
        targetTier,
        targetDivision,
      })
    : createUnitQuote({
        mode: mode as Extract<PriceMode, 'wins' | 'md5' | 'coaching'>,
        tier: unitTier,
        quantity,
      })
  const baseTotal = quote?.suggestedTotal ?? 0
  const referenceTier = isDivisionMode ? currentTier : unitTier
  const referenceRange = getReferenceRange(mode, referenceTier)
  const referenceFixedValue = getFixedPriceValue(referenceRange)
  const invalidLadder =
    isDivisionMode && quote === null
      ? 'Escolha um elo desejado acima do elo atual para liberar a estimativa.'
      : null
  const currentRow = getPriceRow(isDivisionMode ? currentTier : unitTier)
  const targetRow = getPriceRow(isDivisionMode ? targetTier : unitTier)
  const supportsChampionSelector = isDivisionMode && game === 'lol'
  const supportsFlashPosition = isDivisionMode && game !== 'tft'
  const supportsRoutes = isDivisionMode && game !== 'tft'
  const supportsMmrProfile = isDivisionMode && game !== 'tft'
  const supportsReduceKda = isDivisionMode && game !== 'tft'
  const supportsSoloOnly = isDivisionMode && mode !== 'solo'

  useEffect(() => {
    if (!supportsChampionSelector) {
      return
    }

    let active = true

    void getLolChampionOptions()
      .then((champions) => {
        if (active) {
          setChampionOptions(champions)
        }
      })
      .catch(() => {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Campeoes indisponiveis',
            description: 'Nao foi possivel carregar a lista oficial de campeoes agora.',
          })
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingChampions(false)
        }
      })

    return () => {
      active = false
    }
  }, [addToast, supportsChampionSelector])

  const routeOptions = routeOptionsByGame[game]
  const filteredChampionOptions = useMemo(() => {
    if (!supportsChampionSelector) {
      return []
    }

    const normalizedQuery = championQuery.trim().toLowerCase()

    return championOptions
      .filter((champion) => !addons.specificChampions.includes(champion.id))
      .filter((champion) => (normalizedQuery ? champion.name.toLowerCase().includes(normalizedQuery) : true))
      .slice(0, 10)
  }, [addons.specificChampions, championOptions, championQuery, supportsChampionSelector])

  const paidAddons = useMemo(() => {
    const entries: Array<{ key: string; label: string; percent: number }> = []

    if (addons.mmrProfile === 'nerfed') {
      entries.push({ key: 'mmr_nerfed', label: 'Taxa MMR nerfado', percent: 25 })
    }

    if (addons.mmrProfile === 'buffed') {
      entries.push({ key: 'mmr_buffed', label: 'Taxa MMR buffado', percent: 35 })
    }

    if (addons.priorityService) {
      entries.push({ key: 'priority_service', label: 'Servico prioritario', percent: 10 })
    }

    if (addons.favoriteBooster) {
      entries.push({ key: 'favorite_booster', label: 'Booster favorito', percent: 10 })
    }

    if (addons.superRestriction) {
      entries.push({ key: 'super_restriction', label: 'Super restricao', percent: 35 })
    }

    if (addons.extraWin) {
      entries.push({ key: 'extra_win', label: 'Vitoria extra', percent: 20 })
    }

    if (addons.restrictedHours) {
      entries.push({ key: 'restricted_hours', label: 'Horarios restritos', percent: 10 })
    }

    if (supportsReduceKda && addons.reduceKda) {
      entries.push({ key: 'reduce_kda', label: 'Reducao do KD', percent: 30 })
    }

    if (addons.reduceDelivery) {
      entries.push({ key: 'reduce_delivery', label: 'Reducao no prazo de entrega', percent: 20 })
    }

    if (supportsSoloOnly && addons.soloOnly) {
      entries.push({ key: 'solo_only', label: 'Servico solo', percent: 30 })
    }

    return entries
  }, [addons, supportsReduceKda, supportsSoloOnly])

  const freeAddons = useMemo(() => {
    const entries: string[] = []

    if (addons.chatOffline) {
      entries.push('Chat offline')
    }

    if (supportsFlashPosition && addons.flashPositionEnabled) {
      entries.push(`Posicao de feiticos (${addons.flashPosition})`)
    }

    if (supportsRoutes && addons.routesEnabled && addons.specificRoutes.length) {
      entries.push(`Rotas especificas: ${addons.specificRoutes.join(', ')}`)
    }

    if (supportsChampionSelector && addons.championPoolEnabled && addons.specificChampions.length) {
      entries.push(`Campeoes especificos: ${addons.specificChampions.join(', ')}`)
    }

    if (addons.streamOnline) {
      entries.push('Stream online')
    }

    return entries
  }, [addons, supportsChampionSelector, supportsFlashPosition, supportsRoutes])

  const addonPercent = paidAddons.reduce((total, addon) => total + addon.percent, 0)
  const addonAmount = Math.round(baseTotal * (addonPercent / 100))
  const finalTotal = baseTotal + addonAmount

  async function handleCreateOrder(method: 'pix' | 'card') {
    if (!canCheckout || !quote) {
      if (invalidLadder) {
        addToast({
          tone: 'error',
          title: 'Ajuste a rota do pedido',
          description: invalidLadder,
        })
      }

      return
    }

    setCreatingMethod(method)

    try {
      const provider = method === 'pix' ? 'mercado_pago' : 'stripe'
      const titleText = isDivisionMode
        ? `${getGameLabel(game)} · ${modeMeta.label} ${quote.ladderText}`
        : `${getGameLabel(game)} · ${modeMeta.label} ${formatTierDivision(unitTier)}`
      const descriptionText = `${modeMeta.shortDescription} ${quote.summary}.`
      const { order, transaction } = await systemService.createCustomerPayment({
        service_type: modeMeta.serviceType,
        title: titleText,
        description: descriptionText,
        amount: finalTotal,
        provider,
        method,
        metadata: {
          game,
          calculator_mode: mode,
          calculator_family: activeFamily,
          base_price: baseTotal,
          addon_percent: addonPercent,
          addon_amount: addonAmount,
          final_total: finalTotal,
          quote_summary: quote.summary,
          ladder_text: quote.ladderText,
          current_tier: isDivisionMode ? currentTier : unitTier,
          current_division: isDivisionMode && !isApexTier(currentTier) ? currentDivision : null,
          target_tier: isDivisionMode ? targetTier : null,
          target_division: isDivisionMode && !isApexTier(targetTier) ? targetDivision : null,
          quantity: isDivisionMode ? null : quantity,
          addons: isDivisionMode
            ? {
                mmr_profile: addons.mmrProfile,
                chat_offline: addons.chatOffline,
                flash_position: supportsFlashPosition && addons.flashPositionEnabled ? addons.flashPosition : null,
                specific_routes: supportsRoutes && addons.routesEnabled ? addons.specificRoutes : [],
                priority_service: addons.priorityService,
                favorite_booster: addons.favoriteBooster ? addons.favoriteBoosterNote.trim() : null,
                super_restriction: addons.superRestriction,
                extra_win: addons.extraWin,
                specific_champions:
                  supportsChampionSelector && addons.championPoolEnabled ? addons.specificChampions : [],
                restricted_hours: addons.restrictedHours ? addons.restrictedHoursNote.trim() : null,
                stream_online: addons.streamOnline,
                reduce_kda: supportsReduceKda ? addons.reduceKda : false,
                reduce_delivery: addons.reduceDelivery,
                solo_only: supportsSoloOnly ? addons.soloOnly : false,
              }
            : null,
        },
      })

      const nextTransaction: PaymentTransaction = {
        ...transaction,
        service_order: transaction.service_order ?? order,
      }

      onOrderCreated?.({ order, transaction: nextTransaction })

      addToast({
        tone: 'success',
        title: 'Pedido criado',
        description: `Seu pedido de ${titleText} entrou como pendente. Agora e so concluir no ${method === 'pix' ? 'Pix' : 'cartao'}.`,
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Nao foi possivel criar o pedido',
        description: getApiErrorMessage(error, 'Tente novamente em instantes para abrir o pedido.'),
      })
    } finally {
      setCreatingMethod(null)
    }
  }

  function handleSelectFamily(family: ServiceFamily) {
    const nextFamily = familyCards.find((card) => card.family === family)

    if (!nextFamily) {
      return
    }

    setMode(nextFamily.modes[0])
    setIsLoadingChampions(nextFamily.family === 'boost' && game === 'lol')

    if (nextFamily.family !== 'boost') {
      setAddons(createInitialAddons())
    }
  }

  function handleGameSelect(nextGame: GameKey) {
    setGame(nextGame)
    setCurrentTier(getDefaultCurrentTier(nextGame))
    setCurrentDivision('IV')
    setTargetTier(getDefaultTargetTier(nextGame))
    setTargetDivision('IV')
    setUnitTier(getDefaultCurrentTier(nextGame))
    setIsLoadingChampions(nextGame === 'lol' && activeFamily === 'boost')
    setAddons(createInitialAddons())
    setChampionQuery('')
  }

  function handleCurrentTierSelect(nextTier: RankTier) {
    setCurrentTier(nextTier)
  }

  function handleTargetTierSelect(nextTier: RankTier) {
    setTargetTier(nextTier)
  }

  function handleQuantityChange(nextQuantity: number) {
    setQuantity(clampQuantity(nextQuantity))
  }

  function updateAddons(patch: Partial<AddonState>) {
    setAddons((current) => ({ ...current, ...patch }))
  }

  function toggleRoute(route: string) {
    updateAddons({
      specificRoutes: addons.specificRoutes.includes(route)
        ? addons.specificRoutes.filter((item) => item !== route)
        : [...addons.specificRoutes, route],
    })
  }

  function addChampion(championName: string) {
    if (addons.specificChampions.includes(championName)) {
      return
    }

    updateAddons({
      specificChampions: [...addons.specificChampions, championName],
    })
    setChampionQuery('')
  }

  function removeChampion(championName: string) {
    updateAddons({
      specificChampions: addons.specificChampions.filter((item) => item !== championName),
    })
  }

  return (
    <section className={`pricing-builder pricing-builder--${variant} panel`}>
      <div className="pricing-builder__hero">
        <div className="pricing-builder__hero-copy">
          <span className="panel__eyebrow pricing-builder__eyebrow">
            <ArrowUpRight size={14} />
            {eyebrow}
          </span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="pricing-game-rail" aria-label="Jogo">
        {gameCards.map((item) => (
          <button
            key={item.game}
            className={`pricing-game-chip${game === item.game ? ' is-active' : ''}`}
            onClick={() => handleGameSelect(item.game)}
            type="button"
          >
            <span className="pricing-game-chip__icon">
              <Gamepad2 size={16} />
            </span>
            <span className="pricing-game-chip__copy">
              <strong>{item.label}</strong>
              <small>{item.helper}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="pricing-family-grid" aria-label="Familias de servico">
        {familyCards.map((card) => {
          const Icon = card.icon

          return (
            <button
              key={card.family}
              className={`pricing-family-card${activeFamily === card.family ? ' is-active' : ''}`}
              onClick={() => handleSelectFamily(card.family)}
              type="button"
            >
              <span className="pricing-family-card__icon">
                <Icon size={18} />
              </span>
              <span className="pricing-family-card__copy">
                <strong>{card.label}</strong>
                <small>{card.helper}</small>
              </span>
            </button>
          )
        })}
      </div>

      <div className="pricing-mode-rail" aria-label="Tipo do servico">
        {visibleModeCards.map((card) => {
          const Icon = card.icon

          return (
            <button
              key={card.mode}
              className={`pricing-mode-tab${mode === card.mode ? ' is-active' : ''}`}
              onClick={() => setMode(card.mode)}
              type="button"
            >
              <span className="pricing-mode-tab__icon">
                <Icon size={15} />
              </span>
              <span className="pricing-mode-tab__content">
                <strong>{card.label}</strong>
                <small>{card.helper}</small>
              </span>
            </button>
          )
        })}
      </div>

      <div className="pricing-builder__shell">
        <div className="pricing-builder__main panel">
          <div className="pricing-stepper" style={{ gridTemplateColumns: `repeat(${builderSteps.length}, minmax(0, 1fr))` }}>
            {builderSteps.map((step, index) => (
              <div
                className={`pricing-step${index < builderSteps.length - 1 ? ' is-active' : ''}${
                  index === builderSteps.length - 1 && quote ? ' is-armed' : ''
                }`}
                key={step.index}
              >
                <span>{step.index}</span>
                <strong>{step.title}</strong>
                <small>{step.helper}</small>
              </div>
            ))}
          </div>

          <div className="pricing-config">
            <div className="pricing-config__header">
              <div>
                <span className="panel__eyebrow">Configuracao do pedido</span>
                <h3>{familyMeta.label}</h3>
              </div>
            </div>

            <div className="pricing-stage-grid">
              <article className="pricing-stage-card pricing-stage-card--wide">
                <div className="pricing-stage-card__header">
                  <div>
                    <span className="pricing-stage-card__step">01</span>
                    <h4>Jogo e formato</h4>
                    <p>Escolha o jogo atendido pela Horizon e o estilo do pedido.</p>
                  </div>
                </div>

                <div className="pricing-stage-card__body pricing-stage-card__body--split">
                  <div className="pricing-inline-field">
                    <span>Jogo</span>
                    <div className="pricing-inline-pills">
                      {gameCards.map((item) => (
                        <button
                          key={item.game}
                          className={`pricing-inline-chip${game === item.game ? ' is-active' : ''}`}
                          onClick={() => handleGameSelect(item.game)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pricing-inline-field">
                    <span>{activeFamily === 'boost' ? 'Fila' : activeFamily === 'packages' ? 'Pacote' : 'Formato'}</span>
                    <div className="pricing-inline-pills">
                      {visibleModeCards.map((card) => (
                        <button
                          key={card.mode}
                          className={`pricing-inline-chip${mode === card.mode ? ' is-active' : ''}`}
                          onClick={() => setMode(card.mode)}
                          type="button"
                        >
                          {card.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="pricing-stage-card">
                <div className="pricing-stage-card__header">
                  <div>
                    <span className="pricing-stage-card__step">02</span>
                    <h4>{isDivisionMode ? 'Elo inicial' : 'Elo base do calculo'}</h4>
                    {isDivisionMode ? null : <p>Selecione o elo base que sera usado na faixa do servico.</p>}
                  </div>
                </div>

                <div className="pricing-selection-banner">
                  <span>{isDivisionMode ? 'Selecao atual' : `${gameMeta.shortLabel} base`}</span>
                  <strong>{isDivisionMode ? formatTierDivision(currentTier, currentDivision) : currentRow.label}</strong>
                  <small>{isDivisionMode ? formatTierSubtitle(currentTier, currentDivision) : 'Faixa usada no calculo'}</small>
                </div>

                <div className="pricing-tier-cloud" role="list" aria-label={isDivisionMode ? 'Elo atual' : 'Elo base'}>
                  {gameTiers.map((tier) => {
                    const row = getPriceRow(tier)

                    return (
                      <button
                        key={tier}
                        className={`pricing-tier-pill${(isDivisionMode ? currentTier : unitTier) === tier ? ' is-active' : ''}`}
                        onClick={() => {
                          if (isDivisionMode) {
                            handleCurrentTierSelect(tier)
                            return
                          }

                          setUnitTier(tier)
                        }}
                        type="button"
                      >
                        <span>{row.shortLabel}</span>
                        <strong>{row.label}</strong>
                      </button>
                    )
                  })}
                </div>

                {isDivisionMode ? (
                  isApexTier(currentTier) ? (
                    <div className="pricing-apex-note">
                      <strong>{currentRow.label}</strong>
                    </div>
                  ) : (
                    <div className="pricing-division-pills" role="list" aria-label="Divisao atual">
                      {rankDivisions.map((division) => (
                        <button
                          key={division}
                          className={`pricing-division-pill${currentDivision === division ? ' is-active' : ''}`}
                          onClick={() => setCurrentDivision(division)}
                          type="button"
                        >
                          {division}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="pricing-range-banner">
                    <span>Base por unidade</span>
                    <strong>{formatCurrency(referenceFixedValue)}</strong>
                  </div>
                )}
              </article>

              <article className="pricing-stage-card">
                <div className="pricing-stage-card__header">
                  <div>
                    <span className="pricing-stage-card__step">03</span>
                    <h4>{isDivisionMode ? 'Elo final' : activeFamily === 'coaching' ? 'Horas desejadas' : 'Quantidade desejada'}</h4>
                    {isDivisionMode ? null : <p>Ajuste o volume para ver o valor subir em tempo real.</p>}
                  </div>
                </div>

                <div className="pricing-selection-banner">
                  <span>{isDivisionMode ? 'Destino escolhido' : 'Resumo da quantidade'}</span>
                  <strong>{isDivisionMode ? formatTierDivision(targetTier, targetDivision) : modeMeta.label}</strong>
                  <small>{isDivisionMode ? formatTierSubtitle(targetTier, targetDivision) : quote?.summary ?? 'Quantidade ativa'}</small>
                </div>

                {isDivisionMode ? (
                  <>
                    <div className="pricing-tier-cloud" role="list" aria-label="Elo desejado">
                      {gameTiers.map((tier) => {
                        const row = getPriceRow(tier)

                        return (
                          <button
                            key={tier}
                            className={`pricing-tier-pill${targetTier === tier ? ' is-active' : ''}`}
                            onClick={() => handleTargetTierSelect(tier)}
                            type="button"
                          >
                            <span>{row.shortLabel}</span>
                            <strong>{row.label}</strong>
                          </button>
                        )
                      })}
                    </div>

                    {isApexTier(targetTier) ? (
                      <div className="pricing-apex-note">
                        <strong>{targetRow.label}</strong>
                      </div>
                    ) : (
                      <div className="pricing-division-pills" role="list" aria-label="Divisao desejada">
                        {rankDivisions.map((division) => (
                          <button
                            key={division}
                            className={`pricing-division-pill${targetDivision === division ? ' is-active' : ''}`}
                            onClick={() => setTargetDivision(division)}
                            type="button"
                          >
                            {division}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="pricing-quantity-card">
                    <span>{quantityLabels[mode as Extract<PriceMode, 'wins' | 'md5' | 'coaching'>]}</span>

                    <div className="pricing-quantity-control">
                      <button onClick={() => handleQuantityChange(quantity - 1)} type="button">
                        <Minus size={16} />
                      </button>
                      <strong>{clampQuantity(quantity)}</strong>
                      <button onClick={() => handleQuantityChange(quantity + 1)} type="button">
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="pricing-range-banner">
                      <span>Tipo selecionado</span>
                      <strong>{modeMeta.label}</strong>
                    </div>
                  </div>
                )}
              </article>

              {isDivisionMode ? (
                <article className="pricing-stage-card pricing-stage-card--wide">
                  <div className="pricing-stage-card__header">
                    <div>
                      <span className="pricing-stage-card__step">04</span>
                      <h4>Adicionais do pedido</h4>
                      <p>Escolha configuracoes extras e veja o total final subir automaticamente.</p>
                    </div>
                  </div>

                  {supportsMmrProfile ? (
                    <div className="pricing-addon-block">
                      <span className="pricing-addon-block__label">Taxa de MMR</span>
                      <div className="pricing-inline-pills">
                        <button
                          className={`pricing-inline-chip${addons.mmrProfile === 'none' ? ' is-active' : ''}`}
                          onClick={() => updateAddons({ mmrProfile: 'none' })}
                          type="button"
                        >
                          Normal
                        </button>
                        <button
                          className={`pricing-inline-chip${addons.mmrProfile === 'nerfed' ? ' is-active' : ''}`}
                          onClick={() => updateAddons({ mmrProfile: 'nerfed' })}
                          type="button"
                        >
                          MMR nerfado +25%
                        </button>
                        <button
                          className={`pricing-inline-chip${addons.mmrProfile === 'buffed' ? ' is-active' : ''}`}
                          onClick={() => updateAddons({ mmrProfile: 'buffed' })}
                          type="button"
                        >
                          MMR buffado +35%
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="pricing-addon-grid">
                    <ToggleAddonCard
                      active={addons.chatOffline}
                      badge="Gratis"
                      helper="Desejo que o servico seja feito em modo offline."
                      label="Chat offline"
                      onClick={() => updateAddons({ chatOffline: !addons.chatOffline })}
                    />

                    {supportsChampionSelector ? (
                      <ToggleAddonCard
                        active={addons.championPoolEnabled}
                        badge="Gratis"
                        helper="Escolha campeoes prioritarios para o servico."
                        label="Campeoes especificos"
                        onClick={() =>
                          updateAddons({
                            championPoolEnabled: !addons.championPoolEnabled,
                            specificChampions: addons.championPoolEnabled ? [] : addons.specificChampions,
                          })
                        }
                      />
                    ) : null}

                    {supportsFlashPosition ? (
                      <ToggleAddonCard
                        active={addons.flashPositionEnabled}
                        badge="Gratis"
                        helper="Escolha a posicao do Flash entre D ou F."
                        label="Posicao de feiticos"
                        onClick={() => updateAddons({ flashPositionEnabled: !addons.flashPositionEnabled })}
                      />
                    ) : null}

                    {supportsRoutes ? (
                      <ToggleAddonCard
                        active={addons.routesEnabled}
                        badge="Gratis"
                        helper="Determine rotas prioritarias para o servico."
                        label="Rotas especificas"
                        onClick={() =>
                          updateAddons({
                            routesEnabled: !addons.routesEnabled,
                            specificRoutes: addons.routesEnabled ? [] : addons.specificRoutes,
                          })
                        }
                      />
                    ) : null}

                    <ToggleAddonCard
                      active={addons.priorityService}
                      badge="+10%"
                      helper="Seu pedido entra na frente e ganha prioridade operacional."
                      label="Servico prioritario"
                      onClick={() => updateAddons({ priorityService: !addons.priorityService })}
                    />

                    <ToggleAddonCard
                      active={addons.favoriteBooster}
                      badge="+10%"
                      helper="Escolha um booster preferido para assumir o servico."
                      label="Booster favorito"
                      onClick={() => updateAddons({ favoriteBooster: !addons.favoriteBooster })}
                    />

                    <ToggleAddonCard
                      active={addons.superRestriction}
                      badge="+35%"
                      helper="Restrinja ainda mais a execucao e o perfil das partidas."
                      label="Super restricao"
                      onClick={() => updateAddons({ superRestriction: !addons.superRestriction })}
                    />

                    <ToggleAddonCard
                      active={addons.extraWin}
                      badge="+20%"
                      helper="Acrescente uma vitoria extra ao final do servico."
                      label="Vitoria extra"
                      onClick={() => updateAddons({ extraWin: !addons.extraWin })}
                    />

                    <ToggleAddonCard
                      active={addons.restrictedHours}
                      badge="+10%"
                      helper="Defina horarios restritos para a execucao do pedido."
                      label="Horarios restritos"
                      onClick={() => updateAddons({ restrictedHours: !addons.restrictedHours })}
                    />

                    <ToggleAddonCard
                      active={addons.streamOnline}
                      badge="Gratis"
                      helper="Solicite stream online durante a execucao do pedido."
                      label="Stream online"
                      onClick={() => updateAddons({ streamOnline: !addons.streamOnline })}
                    />

                    {supportsReduceKda ? (
                      <ToggleAddonCard
                        active={addons.reduceKda}
                        badge="+30%"
                        helper="Priorize partidas com reducao de KD durante o servico."
                        label="Reducao do KD"
                        onClick={() => updateAddons({ reduceKda: !addons.reduceKda })}
                      />
                    ) : null}

                    <ToggleAddonCard
                      active={addons.reduceDelivery}
                      badge="+20%"
                      helper="Diminua o prazo de entrega do servico."
                      label="Reducao no prazo"
                      onClick={() => updateAddons({ reduceDelivery: !addons.reduceDelivery })}
                    />

                    {supportsSoloOnly ? (
                      <ToggleAddonCard
                        active={addons.soloOnly}
                        badge="+30%"
                        helper="Garanta que as partidas sejam executadas somente em solo."
                        label="Servico solo"
                        onClick={() => updateAddons({ soloOnly: !addons.soloOnly })}
                      />
                    ) : null}
                  </div>

                  <div className="pricing-addon-panels">
                    {supportsFlashPosition && addons.flashPositionEnabled ? (
                      <div className="pricing-addon-panel">
                        <span className="pricing-addon-panel__label">Flash</span>
                        <div className="pricing-inline-pills">
                          <button
                            className={`pricing-inline-chip${addons.flashPosition === 'D' ? ' is-active' : ''}`}
                            onClick={() => updateAddons({ flashPosition: 'D' })}
                            type="button"
                          >
                            Flash no D
                          </button>
                          <button
                            className={`pricing-inline-chip${addons.flashPosition === 'F' ? ' is-active' : ''}`}
                            onClick={() => updateAddons({ flashPosition: 'F' })}
                            type="button"
                          >
                            Flash no F
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {supportsRoutes && addons.routesEnabled ? (
                      <div className="pricing-addon-panel">
                        <span className="pricing-addon-panel__label">Rotas prioritarias</span>
                        <div className="pricing-inline-pills">
                          {routeOptions.map((route) => (
                            <button
                              key={route}
                              className={`pricing-inline-chip${addons.specificRoutes.includes(route) ? ' is-active' : ''}`}
                              onClick={() => toggleRoute(route)}
                              type="button"
                            >
                              {route}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {supportsChampionSelector && addons.championPoolEnabled ? (
                      <div className="pricing-addon-panel">
                        <span className="pricing-addon-panel__label">Campeoes prioritarios</span>
                        <div className="pricing-champion-picker">
                          <input
                            onChange={(event) => setChampionQuery(event.currentTarget.value)}
                            placeholder={isLoadingChampions ? 'Carregando campeoes...' : 'Busque um campeao'}
                            type="text"
                            value={championQuery}
                          />

                          {addons.specificChampions.length ? (
                            <div className="pricing-selected-champions">
                              {addons.specificChampions.map((champion) => (
                                <button key={champion} onClick={() => removeChampion(champion)} type="button">
                                  {champion}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {filteredChampionOptions.length ? (
                            <div className="pricing-champion-suggestions">
                              {filteredChampionOptions.map((champion) => (
                                <button key={champion.key} onClick={() => addChampion(champion.name)} type="button">
                                  {champion.name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {addons.favoriteBooster ? (
                      <div className="pricing-addon-panel">
                        <span className="pricing-addon-panel__label">Booster favorito</span>
                        <input
                          className="pricing-addon-input"
                          onChange={(event) => updateAddons({ favoriteBoosterNote: event.currentTarget.value })}
                          placeholder="Nome ou tag do booster"
                          type="text"
                          value={addons.favoriteBoosterNote}
                        />
                      </div>
                    ) : null}

                    {addons.restrictedHours ? (
                      <div className="pricing-addon-panel">
                        <span className="pricing-addon-panel__label">Horarios permitidos</span>
                        <textarea
                          className="pricing-addon-textarea"
                          onChange={(event) => updateAddons({ restrictedHoursNote: event.currentTarget.value })}
                          placeholder="Ex.: seg a sex das 19h as 23h"
                          rows={3}
                          value={addons.restrictedHoursNote}
                        />
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="pricing-summary-card panel">
          <span className="panel__eyebrow">Resumo do pedido</span>
          <h3>{modeMeta.label}</h3>
          <p>{gameMeta.label} · {modeMeta.shortDescription}</p>

          {quote ? (
            <>
              <div className="pricing-summary-card__price">
                <small>Valor final</small>
                <strong>{formatCurrency(finalTotal)}</strong>
                {isDivisionMode && addonPercent ? (
                  <span>
                    Base {formatCurrency(baseTotal)} + {addonPercent}% em adicionais
                  </span>
                ) : null}
              </div>

              <div className="pricing-summary-card__details">
                <div>
                  <span>Jogo</span>
                  <strong>{gameMeta.label}</strong>
                </div>
                <div>
                  <span>Rota</span>
                  <strong>{quote.ladderText}</strong>
                </div>
                <div>
                  <span>Calculo</span>
                  <strong>{quote.summary}</strong>
                </div>
                <div>
                  <span>Base da rota</span>
                  <strong>{formatCurrency(baseTotal)}</strong>
                </div>
                {isDivisionMode ? (
                  <div>
                    <span>Adicionais</span>
                    <strong>{addonPercent ? `+${addonPercent}% · ${formatCurrency(addonAmount)}` : 'Sem custo extra'}</strong>
                  </div>
                ) : (
                  <div>
                    <span>Base por etapa</span>
                    <strong>{formatCurrency(referenceFixedValue)}</strong>
                  </div>
                )}
              </div>

              {isDivisionMode && (paidAddons.length || freeAddons.length) ? (
                <div className="pricing-summary-card__addon-list">
                  {paidAddons.map((addon) => (
                    <span key={addon.key}>
                      {addon.label} +{addon.percent}%
                    </span>
                  ))}
                  {freeAddons.map((addon) => (
                    <span key={addon}>{addon}</span>
                  ))}
                </div>
              ) : null}

              <div className="pricing-summary-card__status">
                <span className="pricing-status-dot" />
                <div>
                  <strong>Pedido imediato</strong>
                  <small>Seu valor ja esta pronto para seguir para pagamento.</small>
                </div>
              </div>

              {canCheckout ? (
                <div className="pricing-summary-card__actions">
                  <button
                    className="primary-button primary-button--crimson"
                    disabled={creatingMethod !== null}
                    onClick={() => void handleCreateOrder('pix')}
                    type="button"
                  >
                    {creatingMethod === 'pix' ? <Loader2 className="spin-icon" size={16} /> : <ShoppingCart size={16} />}
                    Pagar com Pix
                  </button>
                  <button
                    className="ghost-button"
                    disabled={creatingMethod !== null}
                    onClick={() => void handleCreateOrder('card')}
                    type="button"
                  >
                    {creatingMethod === 'card' ? <Loader2 className="spin-icon" size={16} /> : <CreditCard size={16} />}
                    Pagar no cartao
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="pricing-summary-card__empty">
              <strong>Escolha uma rota valida</strong>
              <p>{invalidLadder}</p>
            </div>
          )}
        </aside>
      </div>

      {showReferenceTable ? (
        <div className="pricing-reference-table panel">
          <div className="pricing-reference-table__header">
            <div>
              <span className="panel__eyebrow">Tabela base</span>
              <h3>Valor por elo</h3>
            </div>
          </div>

          <div className="pricing-reference-table__scroll">
            <div className="pricing-reference-table__row pricing-reference-table__row--head">
              <span>Elo base</span>
              <span>Solo</span>
              <span>Duo</span>
              <span>Wins</span>
              <span>MD5</span>
              <span>Coaching</span>
            </div>

            {priceTable
              .filter((row) => gameTiers.includes(row.tier))
              .map((row) => (
                <div className="pricing-reference-table__row" key={row.tier}>
                  <strong>
                    {row.label}
                    <small>{row.stepType === 'single' ? 'Tier unico' : '4 divisoes'}</small>
                  </strong>
                  <span>{formatCurrency(getFixedPriceValue(row.solo))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.duo))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.wins))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.md5Package))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.coaching))}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
