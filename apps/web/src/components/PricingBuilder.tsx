import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import {
  ArrowUpRight,
  CheckCircle,
  Clock3,
  Copy,
  CreditCard,
  Headphones,
  Loader2,
  Minus,
  Plus,
  QrCode,
  ShoppingCart,
  Sparkles,
  Sword,
  Target,
  TimerReset,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react'
import QRCode from 'qrcode'

import {
  createBoostQuote,
  createUnitQuote,
  formatTierDivision,
  formatTierSubtitle,
  gameCatalog,
  getEloHighBoostReferenceLabel,
  getGameLabel,
  getGameTiers,
  getFixedPriceValue,
  getModeMeta,
  getPriceRow,
  isApexTier,
  priceTable,
  setRuntimePricingTable,
  rankDivisions,
  type GameKey,
  type PriceMode,
  type RankDivision,
  type RankTier,
} from '@/data/pricing'
import { getApiErrorMessage } from '@/services/api/errors'
import { getLolChampionOptions, type LolChampionOption } from '@/services/riot'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import { hasPermission } from '@/utils/authz'
import type {
  PaymentGatewayPayload,
  PaymentMethod,
  PaymentMethodsResponse,
  PaymentTransaction,
  ServiceOrder,
} from '@/types/system'

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

interface PaymentCheckoutState {
  gateway: PaymentGatewayPayload
  order: ServiceOrder
  transaction: PaymentTransaction
}

type PaymentWizardStep = 'summary' | 'method' | 'card' | 'pixConfirm' | 'pixQr' | 'status'
type TerminalPaymentStatus = 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'CANCELLED'

const terminalPaymentStatuses = new Set<string>(['PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED'])
const pixCountdownDurationMs = 30 * 60 * 1000

function normalizePixQrImageSource(qrCodeBase64?: string | null, generatedDataUrl?: string | null): string | null {
  const trimmedBase64 = qrCodeBase64?.trim()

  if (trimmedBase64) {
    return trimmedBase64.startsWith('data:image') ? trimmedBase64 : `data:image/png;base64,${trimmedBase64}`
  }

  return generatedDataUrl ?? null
}

function isTerminalPaymentStatus(status?: string | null): status is TerminalPaymentStatus {
  return Boolean(status && terminalPaymentStatuses.has(status))
}

const modeCards: ModeCard[] = [
  {
    mode: 'solo',
    label: 'Solo Boost',
    helper: 'Subida completa por rota de divisões.',
    icon: Sword,
  },
  {
    mode: 'duo',
    label: 'Duo Boost',
    helper: 'Você joga junto e a rota segue por etapa.',
    icon: Sparkles,
  },
  {
    mode: 'flex',
    label: 'Flex Boost',
    helper: 'Subida na fila Flex com preço ajustado.',
    icon: TrendingUp,
  },
  {
    mode: 'wins',
    label: 'Wins',
    helper: 'Vitórias avulsas para um objetivo rápido.',
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
    helper: 'Sessão por hora com foco em gameplay.',
    icon: Headphones,
  },
]

const familyCards: FamilyCard[] = [
  {
    family: 'boost',
    label: 'Boost por elo',
    helper: 'Subida completa entre dois pontos da ranked.',
    icon: TrendingUp,
    modes: ['solo', 'duo', 'flex'],
  },
  {
    family: 'packages',
    label: 'Pacotes rápidos',
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
    title: 'Serviço',
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
    title: 'Serviço',
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
  wins: 'Quantidade de vitórias',
  md5: 'Quantidade de pacotes',
  coaching: 'Quantidade de horas',
}

const routeOptionsByGame: Record<GameKey, string[]> = {
  lol: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
  wild_rift: ['Baron', 'Jungle', 'Mid', 'Dragon', 'Support'],
  tft: [],
}

const rankEmblems: Record<RankTier, string> = {
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
  sovereign: '/ranks/challenger.png',
}

const maxSpecificChampions = 10
const superRestrictionChampionLimit = 3

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

function formatCurrencyCents(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) / 100)
}

function formatEstimatedDays(days: number) {
  return days === 1 ? '1 dia' : `${days} dias`
}

function formatEstimatedDaysRange(minDays: number, maxDays: number) {
  return minDays === maxDays ? formatEstimatedDays(maxDays) : `${minDays} a ${maxDays} dias`
}

function formatEstimatedDeadline(days: number) {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + days)

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(deadline)
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatCountdown(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getReferenceRange(mode: PriceMode, tier: RankTier) {
  const row = getPriceRow(tier)

  if (mode === 'solo') {
    return row.solo
  }

  if (mode === 'duo') {
    return row.duo
  }

  if (mode === 'flex') {
    return row.solo
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
  if (mode === 'solo' || mode === 'duo' || mode === 'flex') {
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

function ToggleAddonCard(props: {
  active: boolean
  badge: string
  children?: ReactNode
  helper: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <div className={`pricing-addon-card${props.active ? ' is-active' : ''}${props.children ? ' has-detail' : ''}`}>
      <button aria-pressed={props.active} className="pricing-addon-card__toggle" onClick={props.onClick} type="button">
        <div className="pricing-addon-card__top">
          <strong>{props.label}</strong>
          <span>{props.badge}</span>
        </div>
        <small>{props.helper}</small>
      </button>

      {props.active && props.children ? <div className="pricing-addon-card__detail">{props.children}</div> : null}
    </div>
  )
}

function ChampionPickerModal(props: {
  champions: LolChampionOption[]
  isLoading: boolean
  onClose: () => void
  onRemove: (championName: string) => void
  onSelect: (championName: string) => void
  open: boolean
  query: string
  selectedChampions: string[]
  setQuery: (query: string) => void
}) {
  const { champions, isLoading, onClose, onRemove, onSelect, open, query, selectedChampions, setQuery } = props
  const modalRef = useRef<HTMLElement | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleChampions = champions.filter((champion) =>
    normalizedQuery ? champion.name.toLowerCase().includes(normalizedQuery) : true,
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      modalRef.current?.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const modalNode = (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="champion-picker-title"
        aria-modal="true"
        className="champion-picker-modal"
        onMouseDown={(event) => event.stopPropagation()}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <button aria-label="Fechar seleção de campeões" className="confirm-modal__close" onClick={onClose} type="button">
          <X size={18} />
        </button>

        <div className="champion-picker-modal__header">
          <span className="panel__eyebrow">Campeões prioritários</span>
          <h2 id="champion-picker-title">Escolha os campeões</h2>
          <p>
            {selectedChampions.length}/{maxSpecificChampions} selecionados. Com até {superRestrictionChampionLimit}{' '}
            campeões, entra Super restrição e o pedido recebe +35%.
          </p>
        </div>

        <div className="pricing-champion-picker">
          <input
            autoFocus
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={isLoading ? 'Carregando campeões...' : 'Busque um campeão'}
            type="text"
            value={query}
          />

          {selectedChampions.length ? (
            <div className="champion-picker-modal__selected" aria-label="Campeões escolhidos">
              {selectedChampions.map((champion) => (
                <button key={champion} onClick={() => onRemove(champion)} type="button">
                  <span>{champion}</span>
                  <X size={13} />
                </button>
              ))}
            </div>
          ) : null}

          {selectedChampions.length > 0 && selectedChampions.length <= superRestrictionChampionLimit ? (
            <div className="champion-picker-modal__warning">
              Super restrição ativa: + 35% do valor.
            </div>
          ) : null}

          <div className="pricing-champion-suggestions" role="listbox">
            {visibleChampions.map((champion) => (
              <button
                aria-selected={selectedChampions.includes(champion.name)}
                className={selectedChampions.includes(champion.name) ? 'is-selected' : ''}
                key={champion.key}
                onClick={() => onSelect(champion.name)}
                role="option"
                type="button"
              >
                <img alt="" src={champion.iconUrl} />
                <span>{champion.name}</span>
              </button>
            ))}

            {!visibleChampions.length ? (
              <div className="champion-picker-modal__empty">
                {isLoading ? 'Carregando campeões...' : 'Nenhum campeão encontrado.'}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )

  return createPortal(modalNode, document.body)
}


function PaymentWizardProgress({ step }: { step: PaymentWizardStep }) {
  const activeIndex = step === 'summary' ? 0 : step === 'method' ? 1 : 2
  const items = ['Pedido', 'Pagamento', 'Confirmacao']

  return (
    <div className="payment-wizard__progress" aria-label="Progresso do pagamento">
      {items.map((item, index) => (
        <div className={`payment-wizard__progress-item${index <= activeIndex ? ' is-active' : ''}`} key={item}>
          <span>{index + 1}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </div>
  )
}

function StripeCardPaymentForm(props: {
  checkout: PaymentCheckoutState
  onProcessing: (status: string) => void
}) {
  const { checkout, onProcessing } = props
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardholderName, setCardholderName] = useState('')

  async function handleSubmit() {
    if (!stripe || !elements || isSubmitting) {
      return
    }

    const normalizedName = cardholderName.trim()
    if (!normalizedName) {
      setCardError('Informe o nome impresso no cartao.')
      return
    }

    setIsSubmitting(true)
    setCardError(null)

    const paymentId = checkout.gateway.paymentId ?? checkout.transaction.id
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/processing?payment_id=${paymentId}`,
        payment_method_data: {
          billing_details: {
            name: normalizedName,
          },
        },
      },
      redirect: 'if_required',
    })

    if (result.error) {
      setCardError(result.error.message ?? 'A Stripe não conseguiu confirmar o pagamento.')
      setIsSubmitting(false)
      return
    }

    onProcessing(result.paymentIntent?.status === 'succeeded' ? 'PROCESSING' : result.paymentIntent?.status?.toUpperCase() ?? 'PROCESSING')
  }

  return (
    <div className="payment-wizard__stripe">
      <label className="payment-wizard__cardholder">
        <span>Nome no cartao</span>
        <input
          autoComplete="cc-name"
          disabled={isSubmitting}
          onChange={(event) => setCardholderName(event.target.value)}
          placeholder="Como aparece no cartao"
          type="text"
          value={cardholderName}
        />
      </label>
      <div className="payment-wizard__stripe-shell">
        <PaymentElement
          options={{
            layout: {
              type: 'tabs',
              defaultCollapsed: false,
            },
          }}
        />
      </div>
      {cardError ? <div className="payment-wizard__alert payment-wizard__alert--error">{cardError}</div> : null}
      <button
        className="primary-button primary-button--crimson payment-wizard__full-button"
        disabled={!stripe || !elements || isSubmitting}
        onClick={() => void handleSubmit()}
        type="button"
      >
        {isSubmitting ? <Loader2 className="spin-icon" size={16} /> : <CreditCard size={16} />}
        Pagar agora
      </button>
    </div>
  )
}

function PaymentWizardModal(props: {
  addonAmount: number
  addonPercent: number
  createOrder: () => Promise<ServiceOrder>
  deliveryEstimateLabel: string | null
  freeAddons: string[]
  onClose: () => void
  onOrderCreated?: (payload: { transaction: PaymentTransaction; order: ServiceOrder }) => void
  open: boolean
  paidAddons: Array<{ key: string; label: string; percent: number }>
  routeLabel: string
  serviceLabel: string
  total: number
}) {
  const {
    addonAmount,
    addonPercent,
    createOrder,
    deliveryEstimateLabel,
    freeAddons,
    onClose,
    onOrderCreated,
    open,
    paidAddons,
    routeLabel,
    serviceLabel,
    total,
  } = props
  const addToast = useToastStore((state) => state.addToast)
  const modalRef = useRef<HTMLElement | null>(null)
  const createPaymentInFlightRef = useRef(false)
  const [step, setStep] = useState<PaymentWizardStep>('summary')
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [methods, setMethods] = useState<PaymentMethodsResponse | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [installments, setInstallments] = useState(1)
  const [checkout, setCheckout] = useState<PaymentCheckoutState | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [pixCountdownEndsAt, setPixCountdownEndsAt] = useState<number | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState<string | null>(null)

  const selectedOption = methods?.methods.find((method) => method.method === selectedMethod) ?? null
  const clientSecret = checkout?.gateway.clientSecret ?? null
  const publishableKey = checkout?.gateway.publishableKey ?? null
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey])
  const pixCopyPaste = checkout?.gateway.pixCopyPaste ?? null
  const qrCodePayload = checkout?.gateway.qrCode ?? pixCopyPaste
  const qrCodeBase64 = checkout?.gateway.qrCodeBase64 ?? null
  const qrCodeImageSrc = normalizePixQrImageSource(qrCodeBase64, qrCodeDataUrl)
  const expiresAt = checkout?.gateway.expiresAt ?? checkout?.transaction.expiresAt ?? null
  const remainingMs = pixCountdownEndsAt ? Math.max(0, pixCountdownEndsAt - currentTime) : null
  const pollingPaymentId = checkout?.gateway.paymentId ?? checkout?.transaction.id ?? null

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.scrollTo({ top: 0, behavior: 'auto' })
    requestAnimationFrame(() => modalRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBusy, onClose, open])

  useEffect(() => {
    if (!open) {
      const timeoutId = window.setTimeout(() => {
        setStep('summary')
        setOrder(null)
        setMethods(null)
        setSelectedMethod(null)
        setInstallments(1)
        setCheckout(null)
        setPixCountdownEndsAt(null)
        setQrCodeDataUrl(null)
        setStatus(null)
        setError(null)
        setPollingError(null)
        createPaymentInFlightRef.current = false
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }
  }, [open])

  useEffect(() => {
    if (!checkout || step !== 'pixQr' || !qrCodePayload || qrCodeBase64) return

    let active = true

    void QRCode.toDataURL(qrCodePayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#130d0d', light: '#fff7f7' },
    }).then((dataUrl) => {
      if (active) setQrCodeDataUrl(dataUrl)
    })

    return () => {
      active = false
    }
  }, [checkout, qrCodeBase64, qrCodePayload, step])

  useEffect(() => {
    if (step !== 'pixQr') return
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [step])

  useEffect(() => {
    if (!pollingPaymentId || (step !== 'pixQr' && step !== 'status')) return

    let active = true
    const numericPaymentId = Number(pollingPaymentId)

    if (!Number.isFinite(numericPaymentId) || numericPaymentId <= 0) {
      if (import.meta.env.DEV) {
        console.warn('[payments] polling skipped: invalid paymentId', pollingPaymentId)
      }

      return
    }

    const poll = async () => {
      try {
        if (import.meta.env.DEV) {
          console.debug('[payments] polling status', { paymentId: numericPaymentId })
        }

        const payment = await systemService.getPaymentStatus(numericPaymentId)
        if (!active) return
        const nextStatus = payment.status

        if (import.meta.env.DEV) {
          console.debug('[payments] polling response', { paymentId: numericPaymentId, status: nextStatus, payment })
        }

        setPollingError(null)

        if (!nextStatus) {
          return
        }

        setStatus(nextStatus)
        setCheckout((current) => (
          current
            ? {
                ...current,
                transaction: {
                  ...current.transaction,
                  ...payment,
                  qrCode: current.transaction.qrCode ?? payment.qrCode,
                  qrCodeBase64: current.transaction.qrCodeBase64 ?? payment.qrCodeBase64,
                  pixCopyPaste: current.transaction.pixCopyPaste ?? payment.pixCopyPaste,
                },
              }
            : current
        ))

        if (isTerminalPaymentStatus(nextStatus)) {
          setStep('status')
          if (nextStatus === 'PAID') {
            window.setTimeout(() => {
              window.location.href = '/orders'
            }, 2600)
          }
        }
      } catch (requestError) {
        if (!active) return
        setPollingError('Não foi possível atualizar o status agora. Tentando novamente...')

        if (import.meta.env.DEV) {
          console.warn('[payments] polling failed; keeping PIX visible', { paymentId: numericPaymentId, requestError })
        }
      }
    }

    void poll()
    const interval = window.setInterval(() => void poll(), 3000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [pollingPaymentId, step])

  if (!open) return null

  async function proceedToMethods() {
    setIsBusy(true)
    setError(null)
    setPollingError(null)
    setQrCodeDataUrl(null)

    try {
      const nextOrder = order ?? await createOrder()
      setOrder(nextOrder)
      const nextMethods = await systemService.getPaymentMethods(nextOrder.id)
      setMethods(nextMethods)
      const firstAvailable = nextMethods.methods.find((method) => method.available)
      setSelectedMethod((current) => current ?? firstAvailable?.method ?? null)
      setStep('method')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Não foi possível preparar o pagamento.'))
    } finally {
      setIsBusy(false)
    }
  }

  async function createProviderPayment(method: PaymentMethod, nextInstallments = 1) {
    if (!order || createPaymentInFlightRef.current) return

    createPaymentInFlightRef.current = true
    setIsBusy(true)
    setError(null)
    setPollingError(null)

    try {
      if (import.meta.env.DEV) {
        console.debug('[payments] create payment request', {
          orderId: order.id,
          boostId: order.id,
          method,
          installments: nextInstallments,
        })
      }

      const gateway = await systemService.createPayment({
        boostId: order.id,
        orderId: order.id,
        method,
        installments: nextInstallments,
      })
      const normalizedGateway: PaymentGatewayPayload & { payment: PaymentTransaction } = {
        ...gateway,
        paymentId: gateway.paymentId ?? gateway.payment.id,
        status: gateway.status ?? gateway.payment.status,
        qrCode: gateway.qrCode ?? gateway.payment.qrCode ?? null,
        qrCodeBase64: gateway.qrCodeBase64 ?? gateway.payment.qrCodeBase64 ?? null,
        pixCopyPaste: gateway.pixCopyPaste ?? gateway.payment.pixCopyPaste ?? null,
        expiresAt: gateway.expiresAt ?? gateway.payment.expiresAt ?? null,
      }
      const transaction = {
        ...normalizedGateway.payment,
        service_order: normalizedGateway.payment.service_order ?? order,
      }

      if (import.meta.env.DEV) {
        console.debug('[payments] create payment response', {
          gateway: normalizedGateway,
          paymentId: normalizedGateway.paymentId,
          status: normalizedGateway.status,
        })
      }

      setCheckout({ gateway: normalizedGateway, order, transaction })
      setStatus(normalizedGateway.status ?? transaction.status ?? null)
      setCurrentTime(Date.now())
      setPixCountdownEndsAt(method === 'PIX' ? Date.now() + pixCountdownDurationMs : null)
      onOrderCreated?.({ order, transaction })
      setStep(method === 'PIX' ? 'pixQr' : 'card')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Não foi possível iniciar o pagamento.'))
    } finally {
      setIsBusy(false)
      createPaymentInFlightRef.current = false
    }
  }

  async function handleCopyPixCode() {
    if (!pixCopyPaste) return

    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      addToast({ tone: 'success', title: 'Código copiado', description: 'Cole no app do banco para pagar.' })
    } catch {
      addToast({ tone: 'error', title: 'Não foi possível copiar', description: 'Copie o código manualmente.' })
    }
  }

  function handleGenerateNewPix() {
    setOrder(null)
    setCheckout(null)
    setStatus(null)
    setQrCodeDataUrl(null)
    setPixCountdownEndsAt(null)
    setPollingError(null)
    createPaymentInFlightRef.current = false
    setStep('pixConfirm')
  }

  function continueFromMethod() {
    if (!selectedMethod || !selectedOption?.available) return

    if (selectedMethod === 'PIX') {
      setStep('pixConfirm')
      return
    }

    setStep('card')
  }

  function renderSummaryGrid(showPayment = false) {
    return (
      <div className="payment-wizard__summary-grid">
        <div>
          <span>Servico</span>
          <strong>{serviceLabel}</strong>
        </div>
        <div>
          <span>Rota</span>
          <strong>{routeLabel}</strong>
        </div>
        {deliveryEstimateLabel ? (
          <div>
            <span>Prazo</span>
            <strong>{deliveryEstimateLabel}</strong>
          </div>
        ) : null}
        {showPayment && selectedOption ? (
          <div>
            <span>Metodo</span>
            <strong>{selectedOption.label}</strong>
          </div>
        ) : null}
        <div className="payment-wizard__summary-total">
          <span>Valor</span>
          <strong>{showPayment && selectedOption ? formatCurrencyCents(selectedOption.finalAmount) : formatCurrency(total)}</strong>
        </div>
      </div>
    )
  }

  function renderStatusTitle() {
    if (status === 'PAID') return 'Pagamento aprovado'
    if (status === 'PROCESSING' || status === 'REQUIRES_ACTION' || status === 'WAITING_PAYMENT') return 'Pagamento em processamento'
    if (status === 'EXPIRED') return 'PIX expirado'
    return 'Pagamento recusado'
  }

  const paidAmount = checkout?.transaction.finalAmount ?? checkout?.transaction.amount ?? selectedOption?.finalAmount ?? total
  const orderNumber = order?.id ?? checkout?.transaction.orderId
  const methodLabel = selectedOption?.label ?? checkout?.transaction.method ?? 'Pagamento'

  const modalNode = (
    <div className="modal-backdrop" onMouseDown={isBusy ? undefined : onClose}>
      <section
        aria-labelledby="payment-wizard-title"
        aria-modal="true"
        className="payment-wizard"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
        ref={modalRef}
      >
        <button aria-label="Fechar pagamento" className="confirm-modal__close" disabled={isBusy} onClick={onClose} type="button">
          <X size={18} />
        </button>

        <PaymentWizardProgress step={step} />

        <div className="payment-wizard__header">
          <span className="panel__eyebrow">Checkout</span>
          <h2 id="payment-wizard-title">
            {step === 'summary'
              ? 'Revise seu pedido'
              : step === 'method'
                ? 'Escolha o pagamento'
                : step === 'pixConfirm'
                  ? 'Confirmar PIX'
                  : step === 'pixQr'
                    ? 'PIX gerado'
                    : step === 'card'
                      ? 'Dados do cartao'
                      : renderStatusTitle()}
          </h2>
        </div>

        {error ? <div className="payment-wizard__alert payment-wizard__alert--error">{error}</div> : null}

        {step === 'summary' ? (
          <>
            {renderSummaryGrid()}
            {paidAddons.length || freeAddons.length || addonPercent ? (
              <div className="payment-wizard__details">
                {addonPercent ? (
                  <div>
                    <span>Personalizacoes</span>
                    <strong>{formatCurrency(addonAmount)}</strong>
                  </div>
                ) : null}
                {[...paidAddons.map((addon) => addon.label), ...freeAddons].slice(0, 6).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
            <div className="payment-wizard__actions">
              <button className="primary-button primary-button--crimson" disabled={isBusy} onClick={() => void proceedToMethods()} type="button">
                {isBusy ? <Loader2 className="spin-icon" size={16} /> : <ShoppingCart size={16} />}
                Prosseguir para o pagamento
              </button>
            </div>
          </>
        ) : null}

        {step === 'method' ? (
          <>
            <div className="payment-wizard__method-grid">
              {methods?.methods.map((option) => {
                const Icon = option.method === 'PIX' ? QrCode : CreditCard
                return (
                  <button
                    className={`payment-wizard__method-card${selectedMethod === option.method ? ' is-selected' : ''}`}
                    disabled={!option.available}
                    key={option.method}
                    onClick={() => {
                      setSelectedMethod(option.method)
                      setInstallments(1)
                      setCheckout(null)
                      setStatus(null)
                      setPollingError(null)
                    }}
                    type="button"
                  >
                    <Icon size={20} />
                    <span>{option.label}</span>
                    <strong>{formatCurrencyCents(option.finalAmount)}</strong>
                  </button>
                )
              })}
            </div>
            <div className="payment-wizard__actions">
              <button className="ghost-button" disabled={isBusy} onClick={() => setStep('summary')} type="button">
                Voltar
              </button>
              <button className="primary-button primary-button--crimson" disabled={!selectedOption?.available || isBusy} onClick={continueFromMethod} type="button">
                Continuar
              </button>
            </div>
          </>
        ) : null}

        {step === 'pixConfirm' && selectedOption ? (
          <>
            {renderSummaryGrid(true)}
            <div className="payment-wizard__actions">
              <button className="ghost-button" disabled={isBusy} onClick={() => setStep('method')} type="button">
                Voltar
              </button>
              <button className="primary-button primary-button--crimson" disabled={isBusy} onClick={() => void createProviderPayment('PIX')} type="button">
                {isBusy ? <Loader2 className="spin-icon" size={16} /> : <QrCode size={16} />}
                Gerar PIX
              </button>
            </div>
          </>
        ) : null}

        {step === 'pixQr' ? (
          <div className="payment-wizard__pix-layout">
            <div className="payment-wizard__qr-frame">
              {qrCodeImageSrc ? (
                <img alt="QR Code Pix do pedido" src={qrCodeImageSrc} />
              ) : (
                <QrCode size={44} />
              )}
            </div>
            <div className="payment-wizard__pix-copy">
              <div className="payment-wizard__status-pill">
                <Clock3 size={16} />
                <span>Aguardando pagamento</span>
              </div>
              <label className="payment-wizard__copy-block">
                <span>Código PIX</span>
                <textarea readOnly rows={5} value={pixCopyPaste ?? ''} />
              </label>
              {pollingError ? <div className="payment-wizard__alert payment-wizard__alert--soft">{pollingError}</div> : null}
              <div className="payment-wizard__timer">
                <span>Validade</span>
                <strong>{remainingMs !== null ? formatCountdown(remainingMs) : formatDateTime(expiresAt) ?? 'Aguardando'}</strong>
              </div>
              <button className="primary-button primary-button--crimson" disabled={!pixCopyPaste} onClick={() => void handleCopyPixCode()} type="button">
                <Copy size={16} />
                Copiar código PIX
              </button>
            </div>
          </div>
        ) : null}

        {step === 'card' && selectedOption ? (
          <>
            {renderSummaryGrid(true)}
            {selectedMethod === 'CREDIT_CARD' ? (
              <div className="payment-wizard__installments" aria-label="Parcelas">
                {selectedOption.installments.map((item) => (
                  <button
                    className={installments === item.quantity ? 'is-selected' : ''}
                    key={item.quantity}
                    onClick={() => setInstallments(item.quantity)}
                    type="button"
                  >
                    <span>{item.quantity}x</span>
                    <strong>{formatCurrencyCents(item.amount)}</strong>
                  </button>
                ))}
              </div>
            ) : null}
            {!checkout ? (
              <div className="payment-wizard__actions">
                <button className="ghost-button" disabled={isBusy} onClick={() => setStep('method')} type="button">
                  Voltar
                </button>
                <button
                  className="primary-button primary-button--crimson"
                  disabled={isBusy || !selectedMethod}
                  onClick={() => selectedMethod && void createProviderPayment(selectedMethod, selectedMethod === 'CREDIT_CARD' ? installments : 1)}
                  type="button"
                >
                  {isBusy ? <Loader2 className="spin-icon" size={16} /> : <CreditCard size={16} />}
                  Continuar
                </button>
              </div>
            ) : clientSecret && stripePromise ? (
              <Elements
                key={clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: stripePaymentAppearance,
                  loader: 'auto',
                }}
              >
                <StripeCardPaymentForm
                  checkout={checkout}
                  onProcessing={(nextStatus) => {
                    setStatus(nextStatus)
                    setStep('status')
                  }}
                />
              </Elements>
            ) : (
              <div className="payment-wizard__alert payment-wizard__alert--error">Não foi possível iniciar o pagamento com cartão.</div>
            )}
          </>
        ) : null}

        {step === 'status' ? (
          <div className={`payment-wizard__status${status === 'PAID' ? ' payment-wizard__status--paid' : ''}`}>
            {status === 'PAID' ? (
              <>
                <div className="payment-wizard__success-icon">
                  <CheckCircle size={58} />
                </div>
                <strong>Pagamento aprovado</strong>
                <span>Seu pedido foi confirmado e ja entrou na fila de atendimento.</span>
                <div className="payment-wizard__receipt">
                  <div>
                    <span>Valor pago</span>
                    <strong>{typeof paidAmount === 'number' && paidAmount > 999 ? formatCurrencyCents(paidAmount) : formatCurrency(Number(paidAmount))}</strong>
                  </div>
                  <div>
                    <span>Pedido</span>
                    <strong>#{orderNumber}</strong>
                  </div>
                  <div>
                    <span>Metodo</span>
                    <strong>{methodLabel}</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <strong>{renderStatusTitle()}</strong>
                <span>Assim que o pagamento for confirmado, seu pedido entra na fila de atendimento.</span>
                {status === 'EXPIRED' && selectedMethod === 'PIX' ? (
                  <button className="primary-button primary-button--crimson" onClick={handleGenerateNewPix} type="button">
                    <QrCode size={16} />
                    Gerar novo PIX
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )

  return createPortal(modalNode, document.body)
}

export function PricingBuilder({
  variant = 'page',
  canCheckout = true,
  showReferenceTable = variant === 'page',
  eyebrow = 'Tabela de preços',
  title = 'Escolha o serviço e monte sua rota',
  description = 'Escolha o jogo, ajuste o elo atual e o destino final. A Horizon recalcula tudo na hora com a ladder correta de cada fila.',
  onOrderCreated,
}: PricingBuilderProps) {
  const addToast = useToastStore((state) => state.addToast)
  const user = useSessionStore((state) => state.user)
  const accessToken = useSessionStore((state) => state.accessToken)
  const [game] = useState<GameKey>('lol')
  const [mode, setMode] = useState<PriceMode>('solo')
  const [winsQueue, setWinsQueue] = useState<'solo' | 'duo'>('solo')
  const [currentTier, setCurrentTier] = useState<RankTier>('silver')
  const [currentDivision, setCurrentDivision] = useState<RankDivision>('IV')
  const [targetTier, setTargetTier] = useState<RankTier>('gold')
  const [targetDivision, setTargetDivision] = useState<RankDivision>('IV')
  const [unitTier, setUnitTier] = useState<RankTier>('silver')
  const [quantity, setQuantity] = useState(1)
  const [addons, setAddons] = useState<AddonState>(() => createInitialAddons())
  const [championQuery, setChampionQuery] = useState('')
  const [isChampionPickerOpen, setIsChampionPickerOpen] = useState(false)

  // Only load admin pricing for users with admin permission to avoid leaking
  // editable pricing to boosters or customers.
  useEffect(() => {
    const user = useSessionStore.getState().user
    if (!user || !hasPermission(user, 'users.view_all')) return

    let active = true

    async function loadAdminPricing() {
      try {
        const adminPricing = await systemService.getAdminPricing()
        if (!active) return
        if (Array.isArray(adminPricing) && adminPricing.length) {
          setRuntimePricingTable(adminPricing)
        }
      } catch (e) {
        // ignore — fallback to built-in table
      }
    }

    loadAdminPricing()

    return () => {
      active = false
    }
  }, [])
  const [championOptions, setChampionOptions] = useState<LolChampionOption[]>([])
  const [isLoadingChampions, setIsLoadingChampions] = useState(true)
  const [isPaymentWizardOpen, setIsPaymentWizardOpen] = useState(false)

  const activeFamily = getFamilyForMode(mode)
  const familyMeta = familyCards.find((card) => card.family === activeFamily) ?? familyCards[0]
  const visibleModeCards = modeCards.filter((card) => familyMeta.modes.includes(card.mode))
  const modeMeta = getModeMeta(mode)
  const gameMeta = gameCatalog[game]
  const gameTiers = useMemo(() => getGameTiers(game), [game])
  const isDivisionMode = activeFamily === 'boost'
  const builderSteps = useMemo(() => {
    const steps = isDivisionMode ? divisionSteps : defaultSteps

    return canCheckout ? steps : steps.filter((step) => step.title !== 'Pagamento')
  }, [canCheckout, isDivisionMode])
  const quote = isDivisionMode
    ? createBoostQuote({
        mode: mode as Extract<PriceMode, 'solo' | 'duo' | 'flex'>,
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
  const deliveryEstimate =
    isDivisionMode && quote && 'estimatedDays' in quote
      ? (() => {
          const fixedRange = quote.estimatedDaysRange
          const baseDays = fixedRange?.max ?? quote.estimatedDays
          const estimatedDays = fixedRange ? baseDays : addons.reduceDelivery ? Math.max(1, Math.ceil(baseDays * 0.8)) : baseDays
          const durationLabel = fixedRange
            ? formatEstimatedDaysRange(fixedRange.min, fixedRange.max)
            : formatEstimatedDays(estimatedDays)
          const deadlineLabel = formatEstimatedDeadline(estimatedDays)

          return {
            baseDays,
            days: estimatedDays,
            durationLabel,
            deadlineLabel,
            fullLabel: `${durationLabel} · até ${deadlineLabel}`,
          }
        })()
      : null
  const supportsReduceDelivery = !quote || !('estimatedDaysRange' in quote && quote.estimatedDaysRange)
  const currentRow = getPriceRow(isDivisionMode ? currentTier : unitTier)
  const targetRow = getPriceRow(isDivisionMode ? targetTier : unitTier)
  const supportsChampionSelector = isDivisionMode && game === 'lol'
  const supportsFlashPosition = isDivisionMode && game !== 'tft'
  const supportsRoutes = isDivisionMode && game !== 'tft'
  const supportsMmrProfile = isDivisionMode && game !== 'tft'
  const supportsReduceKda = isDivisionMode && game !== 'tft'
  const supportsSoloOnly = isDivisionMode && mode !== 'solo'
  const hasChampionSuperRestriction =
    supportsChampionSelector &&
    addons.specificChampions.length > 0 &&
    addons.specificChampions.length <= superRestrictionChampionLimit
  const effectiveSuperRestriction = addons.superRestriction || hasChampionSuperRestriction

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
            title: 'Campeões indisponíveis',
            description: 'Não foi possível carregar a lista oficial de campeões agora.',
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

  const paidAddons = useMemo(() => {
    const entries: Array<{ key: string; label: string; percent: number }> = []

    if (addons.mmrProfile === 'nerfed') {
      entries.push({ key: 'mmr_nerfed', label: 'Taxa MMR nerfado', percent: 25 })
    }

    if (addons.mmrProfile === 'buffed') {
      entries.push({ key: 'mmr_buffed', label: 'Taxa MMR buffado', percent: 35 })
    }

    if (addons.priorityService) {
      entries.push({ key: 'priority_service', label: 'Serviço prioritário', percent: 10 })
    }

    if (addons.favoriteBooster) {
      entries.push({ key: 'favorite_booster', label: 'Booster favorito', percent: 10 })
    }

    if (effectiveSuperRestriction) {
      entries.push({ key: 'super_restriction', label: 'Super restrição', percent: 35 })
    }

    if (addons.extraWin) {
      entries.push({ key: 'extra_win', label: 'Vitoria extra', percent: 20 })
    }

    if (addons.restrictedHours) {
      entries.push({ key: 'restricted_hours', label: 'Horarios restritos', percent: 10 })
    }

    if (addons.streamOnline) {
      entries.push({ key: 'stream_online', label: 'Stream online', percent: 10 })
    }

    if (supportsReduceKda && addons.reduceKda) {
      entries.push({ key: 'reduce_kda', label: 'Reducao do KD', percent: 30 })
    }

    if (supportsReduceDelivery && addons.reduceDelivery) {
      entries.push({ key: 'reduce_delivery', label: 'Reducao no prazo de entrega', percent: 20 })
    }

    if (supportsSoloOnly && addons.soloOnly) {
      entries.push({ key: 'solo_only', label: 'Serviço solo', percent: 30 })
    }

    return entries
  }, [addons, effectiveSuperRestriction, supportsReduceDelivery, supportsReduceKda, supportsSoloOnly])

  const freeAddons = useMemo(() => {
    const entries: string[] = []

    if (addons.chatOffline) {
      entries.push('Chat offline')
    }

    if (supportsFlashPosition && addons.flashPositionEnabled) {
      entries.push(`Posição de feitiços (${addons.flashPosition})`)
    }

    if (supportsRoutes && addons.routesEnabled && addons.specificRoutes.length) {
      entries.push(`Rotas especificas: ${addons.specificRoutes.join(', ')}`)
    }

    if (supportsChampionSelector && addons.championPoolEnabled && addons.specificChampions.length) {
      entries.push(`Campeões específicos: ${addons.specificChampions.join(', ')}`)
    }

    return entries
  }, [addons, supportsChampionSelector, supportsFlashPosition, supportsRoutes])

  const addonPercent = paidAddons.reduce((total, addon) => total + addon.percent, 0)
  const addonAmount = Math.round(baseTotal * (addonPercent / 100))
  const finalTotal = baseTotal + addonAmount

  async function createOrderDraft(): Promise<ServiceOrder> {
    if (!canCheckout || !quote) {
      throw new Error(invalidLadder ?? 'Pedido indisponível para pagamento.')
    }

    const titleText = isDivisionMode
      ? `${getGameLabel(game)} · ${modeMeta.label} ${quote.ladderText}`
      : `${getGameLabel(game)} · ${modeMeta.label} ${formatTierDivision(unitTier)}`
    const descriptionText = `${modeMeta.shortDescription} ${quote.summary}.`
    let adjustedFinalTotal = finalTotal
    if (!isDivisionMode && mode === 'wins' && winsQueue === 'duo') {
      const multiplier = Number(import.meta.env.VITE_WINS_DUO_MULTIPLIER ?? '1') || 1
      adjustedFinalTotal = Math.round(finalTotal * multiplier)
    }

    const { order } = await systemService.createCustomerPayment({
      service_type: modeMeta.serviceType,
      title: titleText,
      description: descriptionText,
      amount: Math.round(adjustedFinalTotal * 100),
      metadata: {
        game,
        calculator_mode: mode,
        calculator_family: activeFamily,
        base_price: baseTotal,
        addon_percent: addonPercent,
        addon_amount: addonAmount,
        final_total: adjustedFinalTotal,
        quote_summary: quote.summary,
        ladder_text: quote.ladderText,
        estimated_delivery_days: deliveryEstimate?.days ?? null,
        estimated_delivery_label: deliveryEstimate?.fullLabel ?? null,
        estimated_delivery_deadline: deliveryEstimate?.deadlineLabel ?? null,
        current_tier: isDivisionMode ? currentTier : unitTier,
        current_division: isDivisionMode && !isApexTier(currentTier) ? currentDivision : null,
        target_tier: isDivisionMode ? targetTier : null,
        target_division: isDivisionMode && !isApexTier(targetTier) ? targetDivision : null,
        quantity: isDivisionMode ? null : quantity,
        queue: !isDivisionMode && mode === 'wins' ? winsQueue : undefined,
        addons: isDivisionMode
          ? {
              mmr_profile: addons.mmrProfile,
              chat_offline: addons.chatOffline,
              flash_position: supportsFlashPosition && addons.flashPositionEnabled ? addons.flashPosition : null,
              specific_routes: supportsRoutes && addons.routesEnabled ? addons.specificRoutes : [],
              priority_service: addons.priorityService,
              favorite_booster: addons.favoriteBooster ? addons.favoriteBoosterNote.trim() : null,
              super_restriction: effectiveSuperRestriction,
              extra_win: addons.extraWin,
              specific_champions: supportsChampionSelector && addons.championPoolEnabled ? addons.specificChampions : [],
              restricted_hours: addons.restrictedHours ? addons.restrictedHoursNote.trim() : null,
              stream_online: addons.streamOnline,
              reduce_kda: supportsReduceKda ? addons.reduceKda : false,
              reduce_delivery: addons.reduceDelivery,
              solo_only: supportsSoloOnly ? addons.soloOnly : false,
            }
          : null,
      },
    })

    return order
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

    if (addons.specificChampions.length >= maxSpecificChampions) {
      addToast({
        tone: 'error',
        title: 'Limite de campeões',
        description: `Você pode escolher no máximo ${maxSpecificChampions} campeões específicos.`,
      })
      return
    }

    const nextSpecificChampions = [...addons.specificChampions, championName]

    updateAddons({
      championPoolEnabled: true,
      specificChampions: nextSpecificChampions,
      superRestriction: nextSpecificChampions.length <= superRestrictionChampionLimit,
    })
    setChampionQuery('')

    if (nextSpecificChampions.length <= superRestrictionChampionLimit) {
      addToast({
        tone: 'info',
        title: 'Super restrição ativa',
        description: 'Com até 3 campeões específicos, o pedido recebe +35% no valor.',
      })
    }
  }

  function removeChampion(championName: string) {
    const nextSpecificChampions = addons.specificChampions.filter((item) => item !== championName)

    updateAddons({
      championPoolEnabled: nextSpecificChampions.length > 0,
      specificChampions: nextSpecificChampions,
      superRestriction:
        nextSpecificChampions.length > 0 && nextSpecificChampions.length <= superRestrictionChampionLimit,
    })
  }

  function handleStartPayment() {
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

    if (!user || !accessToken) {
      addToast({
        tone: 'error',
        title: 'Entre para comprar',
        description: 'Faça login ou crie sua conta antes de gerar o pagamento.',
      })
      window.location.href = '/login'
      return
    }

    setIsPaymentWizardOpen(true)
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

      <div className="pricing-family-grid" aria-label="Famílias de serviço">
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

      <div className="pricing-mode-rail" aria-label="Tipo do serviço">
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
                <span className="panel__eyebrow">Configuração do pedido</span>
                <h3>{familyMeta.label}</h3>
              </div>
            </div>

            <div className="pricing-stage-grid">
              <article className="pricing-stage-card">
                <div className="pricing-stage-card__header">
                  <div>
                    <span className="pricing-stage-card__step">01</span>
                    <h4>{isDivisionMode ? 'Elo inicial' : 'Elo base do calculo'}</h4>
                    {isDivisionMode ? null : <p>Selecione o elo base que será usado na faixa do serviço.</p>}
                  </div>
                </div>

                <div className="pricing-selection-banner">
                  {isDivisionMode ? (
                    <img alt="" className="pricing-selection-banner__emblem" src={rankEmblems[currentTier]} />
                  ) : null}
                  <span>{isDivisionMode ? 'Seleção atual' : `${gameMeta.shortLabel} base`}</span>
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
                        <img alt="" className="pricing-tier-pill__emblem" src={rankEmblems[tier]} />
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
                    <div className="pricing-division-pills" role="list" aria-label="Divisão atual">
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
                    <span className="pricing-stage-card__step">02</span>
                    <h4>{isDivisionMode ? 'Elo final' : activeFamily === 'coaching' ? 'Horas desejadas' : 'Quantidade desejada'}</h4>
                    {isDivisionMode ? null : <p>Ajuste o volume para ver o valor subir em tempo real.</p>}
                  </div>
                </div>

                <div className="pricing-selection-banner">
                  {isDivisionMode ? (
                    <img alt="" className="pricing-selection-banner__emblem" src={rankEmblems[targetTier]} />
                  ) : null}
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
                            <img alt="" className="pricing-tier-pill__emblem" src={rankEmblems[tier]} />
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
                      <div className="pricing-division-pills" role="list" aria-label="Divisão desejada">
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
                      {mode === 'wins' ? (
                        <div className="pricing-wins-queue">
                          <span className="pricing-wins-queue__label">Fila das vitórias</span>
                          <div className="pricing-wins-queue__options">
                            <label>
                              <input type="radio" name="winsQueue" value="solo" checked={winsQueue === 'solo'} onChange={() => setWinsQueue('solo')} /> Solo
                            </label>
                            <label>
                              <input type="radio" name="winsQueue" value="duo" checked={winsQueue === 'duo'} onChange={() => setWinsQueue('duo')} /> Duo
                            </label>
                          </div>
                        </div>
                      ) : null}
                  </div>
                )}
              </article>

              {isDivisionMode ? (
                <article className="pricing-stage-card pricing-stage-card--wide">
                  <div className="pricing-stage-card__header">
                    <div>
                      <span className="pricing-stage-card__step">03</span>
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
                      helper="Desejo que o serviço seja feito em modo offline."
                      label="Chat offline"
                      onClick={() => updateAddons({ chatOffline: !addons.chatOffline })}
                    />

                    {supportsChampionSelector ? (
                      <ToggleAddonCard
                        active={addons.championPoolEnabled || addons.specificChampions.length > 0}
                        badge="Gratis"
                        helper={
                          addons.specificChampions.length ? (
                            <>
                              <span className="pricing-champion-name-list">
                                {addons.specificChampions.map((champion) => (
                                  <span key={champion}>
                                    {champion}
                                    <span
                                      aria-label={`Remover ${champion}`}
                                      className="pricing-champion-name-list__remove"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        removeChampion(champion)
                                      }}
                                      role="button"
                                      tabIndex={0}
                                    >
                                      <X size={12} />
                                    </span>
                                  </span>
                                ))}
                              </span>
                              {addons.specificChampions.length <= superRestrictionChampionLimit ? (
                                <span className="pricing-champion-restriction-note">
                                  Super restrição ativa: +35%
                                </span>
                              ) : null}
                            </>
                          ) : (
                            'Escolha campeões prioritários para o serviço.'
                          )
                        }
                        label="Campeões específicos"
                        onClick={() => {
                          updateAddons({
                            championPoolEnabled: true,
                          })
                          setIsChampionPickerOpen(true)
                        }}
                      />
                    ) : null}

                    {supportsFlashPosition ? (
                      <ToggleAddonCard
                        active={addons.flashPositionEnabled}
                        badge="Gratis"
                        helper="Escolha a posição do Flash entre D ou F."
                        label="Posição de feitiços"
                        onClick={() => updateAddons({ flashPositionEnabled: !addons.flashPositionEnabled })}
                      >
                        <span className="pricing-addon-card__detail-label">Escolha o lado do Flash</span>
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
                      </ToggleAddonCard>
                    ) : null}

                    {supportsRoutes ? (
                      <ToggleAddonCard
                        active={addons.routesEnabled}
                        badge="Gratis"
                        helper="Determine rotas prioritárias para o serviço."
                        label="Rotas especificas"
                        onClick={() =>
                          updateAddons({
                            routesEnabled: !addons.routesEnabled,
                            specificRoutes: addons.routesEnabled ? [] : addons.specificRoutes,
                          })
                        }
                      >
                        <span className="pricing-addon-card__detail-label">Rotas prioritarias</span>
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
                      </ToggleAddonCard>
                    ) : null}

                    <ToggleAddonCard
                      active={addons.priorityService}
                      badge="+10%"
                      helper="Seu pedido entra na frente e ganha prioridade operacional."
                      label="Serviço prioritário"
                      onClick={() => updateAddons({ priorityService: !addons.priorityService })}
                    />

                    <ToggleAddonCard
                      active={addons.favoriteBooster}
                      badge="+10%"
                      helper="Escolha um booster preferido para assumir o serviço."
                      label="Booster favorito"
                      onClick={() => updateAddons({ favoriteBooster: !addons.favoriteBooster })}
                    >
                      <span className="pricing-addon-card__detail-label">Nome ou tag do booster</span>
                      <input
                        className="pricing-addon-input"
                        onChange={(event) => updateAddons({ favoriteBoosterNote: event.currentTarget.value })}
                        placeholder="Nome ou tag do booster"
                        type="text"
                        value={addons.favoriteBoosterNote}
                      />
                    </ToggleAddonCard>

                    <ToggleAddonCard
                      active={effectiveSuperRestriction}
                      badge="+35%"
                      helper={
                        hasChampionSuperRestriction
                          ? 'Ativa automaticamente quando você escolhe até 3 campeões específicos.'
                          : 'Restrinja ainda mais a execução e o perfil das partidas.'
                      }
                      label="Super restrição"
                      onClick={() => {
                        if (hasChampionSuperRestriction && effectiveSuperRestriction) {
                          addToast({
                            tone: 'info',
                            title: 'Super restrição obrigatória',
                            description: 'Para remover o +35%, escolha 4 ou mais campeões ou remova a restrição de campeões.',
                          })
                          return
                        }

                        updateAddons({ superRestriction: !addons.superRestriction })
                      }}
                    />

                    <ToggleAddonCard
                      active={addons.extraWin}
                      badge="+20%"
                      helper="Acrescente uma vitória extra ao final do serviço."
                      label="Vitoria extra"
                      onClick={() => updateAddons({ extraWin: !addons.extraWin })}
                    />

                    <ToggleAddonCard
                      active={addons.restrictedHours}
                      badge="+10%"
                      helper="Defina horarios restritos para a execucao do pedido."
                      label="Horarios restritos"
                      onClick={() => updateAddons({ restrictedHours: !addons.restrictedHours })}
                    >
                      <span className="pricing-addon-card__detail-label">Horarios permitidos</span>
                      <textarea
                        className="pricing-addon-textarea"
                        onChange={(event) => updateAddons({ restrictedHoursNote: event.currentTarget.value })}
                        placeholder="Ex.: seg a sex das 19h as 23h"
                        rows={3}
                        value={addons.restrictedHoursNote}
                      />
                    </ToggleAddonCard>

                    <ToggleAddonCard
                      active={addons.streamOnline}
                      badge="+10%"
                      helper="Solicite stream online durante a execucao do pedido."
                      label="Stream online"
                      onClick={() => updateAddons({ streamOnline: !addons.streamOnline })}
                    />

                    {supportsReduceKda ? (
                      <ToggleAddonCard
                        active={addons.reduceKda}
                        badge="+30%"
                        helper="Priorize partidas com redução de KDA durante o serviço."
                        label="Reducao do KD"
                        onClick={() => updateAddons({ reduceKda: !addons.reduceKda })}
                      />
                    ) : null}

                    {supportsReduceDelivery ? (
                      <ToggleAddonCard
                        active={addons.reduceDelivery}
                        badge="+20%"
                        helper="Diminua o prazo de entrega do serviço."
                        label="Reducao no prazo"
                        onClick={() => updateAddons({ reduceDelivery: !addons.reduceDelivery })}
                      />
                    ) : null}

                    {supportsSoloOnly ? (
                      <ToggleAddonCard
                        active={addons.soloOnly}
                        badge="+30%"
                        helper="Garanta que as partidas sejam executadas somente em solo."
                        label="Serviço solo"
                        onClick={() => updateAddons({ soloOnly: !addons.soloOnly })}
                      />
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
          <p>{gameMeta.label}</p>

          {quote ? (
            <>
              <div className="pricing-summary-card__price">
                <small>Valor final</small>
                <strong>{formatCurrency(finalTotal)}</strong>
              </div>

              <div className="pricing-summary-card__details">
                <div>
                  <span>Rota</span>
                  <strong>{quote.ladderText}</strong>
                </div>
                <div>
                  <span>Cálculo</span>
                  <strong>{quote.summary}</strong>
                </div>
                {deliveryEstimate ? (
                  <div>
                    <span>Prazo estimado</span>
                    <strong>{deliveryEstimate.fullLabel}</strong>
                  </div>
                ) : null}
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

              {canCheckout ? (
                <div className="pricing-summary-card__actions">
                  <button
                    className="primary-button primary-button--crimson"
                    onClick={handleStartPayment}
                    type="button"
                  >
                    <ShoppingCart size={16} />
                    Prosseguir para o pagamento
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
                    <small>{row.stepType === 'single' ? 'Tier único' : '4 divisões'}</small>
                  </strong>
                  <span>{getEloHighBoostReferenceLabel(row.tier)}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.duo))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.wins))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.md5Package))}</span>
                  <span>{formatCurrency(getFixedPriceValue(row.coaching))}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <ChampionPickerModal
        champions={championOptions}
        isLoading={isLoadingChampions}
        onClose={() => setIsChampionPickerOpen(false)}
        onRemove={removeChampion}
        onSelect={addChampion}
        open={isChampionPickerOpen}
        query={championQuery}
        selectedChampions={addons.specificChampions}
        setQuery={setChampionQuery}
      />

      <PaymentWizardModal
        addonAmount={addonAmount}
        addonPercent={addonPercent}
        createOrder={createOrderDraft}
        deliveryEstimateLabel={deliveryEstimate?.fullLabel ?? null}
        freeAddons={freeAddons}
        onClose={() => setIsPaymentWizardOpen(false)}
        onOrderCreated={onOrderCreated}
        open={isPaymentWizardOpen}
        paidAddons={paidAddons}
        routeLabel={quote?.ladderText ?? modeMeta.label}
        serviceLabel={modeMeta.label}
        total={finalTotal}
      />
    </section>
  )
}

const stripePaymentAppearance = {
  theme: 'night' as const,
  labels: 'above' as const,
  variables: {
    colorPrimary: '#e23a3a',
    colorBackground: '#231f2b',
    colorText: '#fff7f7',
    colorDanger: '#ff7a7a',
    colorTextSecondary: '#c8b9bc',
    colorTextPlaceholder: '#8f858c',
    fontFamily: 'Space Grotesk, Inter, system-ui, sans-serif',
    fontSizeBase: '16px',
    fontWeightNormal: '600',
    spacingUnit: '5px',
    borderRadius: '14px',
    focusBoxShadow: '0 0 0 3px rgba(226, 58, 58, 0.24)',
    focusOutline: 'none',
  },
  rules: {
    '.Block': {
      backgroundColor: 'rgba(255, 255, 255, 0.035)',
      border: '1px solid rgba(255, 255, 255, 0.09)',
      boxShadow: '0 18px 38px rgba(0, 0, 0, 0.2)',
    },
    '.BlockDivider': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    '.Tab': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#d9ccd0',
      borderRadius: '14px',
    },
    '.Tab:hover': {
      color: '#fff7f7',
      borderColor: 'rgba(226, 58, 58, 0.42)',
    },
    '.Tab--selected': {
      backgroundColor: 'rgba(156, 17, 17, 0.32)',
      borderColor: 'rgba(226, 58, 58, 0.72)',
      color: '#fff7f7',
      boxShadow: 'inset 0 0 0 1px rgba(255, 122, 122, 0.16)',
    },
    '.Label': {
      color: '#fff0f0',
      fontWeight: '800',
      fontSize: '14px',
      marginBottom: '8px',
    },
    '.Input': {
      backgroundColor: 'rgba(255, 255, 255, 0.055)',
      border: '1px solid rgba(255, 255, 255, 0.11)',
      color: '#fff7f7',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 28px rgba(0, 0, 0, 0.2)',
      padding: '15px 16px',
    },
    '.Input:hover': {
      borderColor: 'rgba(226, 58, 58, 0.44)',
      backgroundColor: 'rgba(255, 255, 255, 0.075)',
    },
    '.Input:focus': {
      borderColor: '#e23a3a',
      boxShadow: '0 0 0 3px rgba(226, 58, 58, 0.24), 0 18px 38px rgba(0, 0, 0, 0.28)',
    },
    '.Error': {
      color: '#ffd1d1',
      fontWeight: '700',
    },
  },
}
