export type GameKey = 'lol' | 'wild_rift' | 'tft'
export type PriceMode = 'solo' | 'duo' | 'flex' | 'wins' | 'md5' | 'coaching'
export type DivisionalRankTier = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond'
export type ApexRankTier = 'master' | 'grandmaster' | 'challenger' | 'sovereign'
export type RankTier = DivisionalRankTier | ApexRankTier
export type RankDivision = 'IV' | 'III' | 'II' | 'I'

interface PriceRange {
  min: number
  max: number
  plus?: boolean
}

export interface RankPriceRow {
  tier: RankTier
  label: string
  shortLabel: string
  crest: string
  stepType: 'division' | 'single'
  solo: PriceRange
  duo: PriceRange
  wins: PriceRange
  md5Package: PriceRange
  md5Equivalent: PriceRange
  coaching: PriceRange
}

export interface GameMeta {
  key: GameKey
  label: string
  shortLabel: string
  helper: string
  tiers: RankTier[]
}

export interface BoostQuote {
  minTotal: number
  maxTotal: number
  suggestedTotal: number
  divisionCount: number
  estimatedDays: number
  estimatedDaysRange?: {
    min: number
    max: number
  }
  summary: string
  ladderText: string
}

export interface UnitQuote {
  minTotal: number
  maxTotal: number
  suggestedTotal: number
  quantity: number
  summary: string
  ladderText: string
}

interface ProgressionStep {
  key: string
  tier: RankTier
  division?: RankDivision
}

export const rankDivisions: RankDivision[] = ['IV', 'III', 'II', 'I']

export const divisionalRankTiers: DivisionalRankTier[] = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
]

export const apexRankTiers: ApexRankTier[] = ['master', 'grandmaster', 'challenger', 'sovereign']

export const rankedTiers: RankTier[] = [...divisionalRankTiers, ...apexRankTiers]

export const gameCatalog: Record<GameKey, GameMeta> = {
  lol: {
    key: 'lol',
    label: 'League of Legends',
    shortLabel: 'LoL',
    helper: 'Tiers atuais da Solo/Duo do LoL.',
    tiers: ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'],
  },
  wild_rift: {
    key: 'wild_rift',
    label: 'Wild Rift',
    shortLabel: 'Wild Rift',
    helper: 'Inclui o tier Soberano no topo da fila ranqueada.',
    tiers: ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger', 'sovereign'],
  },
  tft: {
    key: 'tft',
    label: 'Teamfight Tactics',
    shortLabel: 'TFT',
    helper: 'Mesmo sistema de tiers principais do TFT ranqueado.',
    tiers: ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'],
  },
}

export const priceTable: RankPriceRow[] = [
  {
    tier: 'iron',
    label: 'Ferro',
    shortLabel: 'Fe',
    crest: 'F',
    stepType: 'division',
    solo: { min: 8, max: 12 },
    duo: { min: 15, max: 25 },
    wins: { min: 3, max: 5 },
    md5Package: { min: 15, max: 25 },
    md5Equivalent: { min: 3, max: 5 },
    coaching: { min: 15, max: 30 },
  },
  {
    tier: 'bronze',
    label: 'Bronze',
    shortLabel: 'Br',
    crest: 'B',
    stepType: 'division',
    solo: { min: 10, max: 15 },
    duo: { min: 20, max: 30 },
    wins: { min: 3, max: 5 },
    md5Package: { min: 20, max: 30 },
    md5Equivalent: { min: 4, max: 6 },
    coaching: { min: 15, max: 30 },
  },
  {
    tier: 'silver',
    label: 'Prata',
    shortLabel: 'Pr',
    crest: 'P',
    stepType: 'division',
    solo: { min: 15, max: 20 },
    duo: { min: 25, max: 40 },
    wins: { min: 4, max: 6 },
    md5Package: { min: 25, max: 40 },
    md5Equivalent: { min: 5, max: 8 },
    coaching: { min: 20, max: 40 },
  },
  {
    tier: 'gold',
    label: 'Ouro',
    shortLabel: 'Au',
    crest: 'O',
    stepType: 'division',
    solo: { min: 18, max: 25 },
    duo: { min: 35, max: 55 },
    wins: { min: 6, max: 9 },
    md5Package: { min: 40, max: 60 },
    md5Equivalent: { min: 8, max: 12 },
    coaching: { min: 30, max: 60 },
  },
  {
    tier: 'platinum',
    label: 'Platina',
    shortLabel: 'Pl',
    crest: 'P',
    stepType: 'division',
    solo: { min: 20, max: 30 },
    duo: { min: 40, max: 70 },
    wins: { min: 8, max: 12 },
    md5Package: { min: 60, max: 90 },
    md5Equivalent: { min: 12, max: 18 },
    coaching: { min: 40, max: 80 },
  },
  {
    tier: 'emerald',
    label: 'Esmeralda',
    shortLabel: 'Es',
    crest: 'E',
    stepType: 'division',
    solo: { min: 30, max: 40 },
    duo: { min: 60, max: 90 },
    wins: { min: 10, max: 15 },
    md5Package: { min: 80, max: 120 },
    md5Equivalent: { min: 16, max: 24 },
    coaching: { min: 60, max: 100 },
  },
  {
    tier: 'diamond',
    label: 'Diamante',
    shortLabel: 'Di',
    crest: 'D',
    stepType: 'division',
    solo: { min: 50, max: 70 },
    duo: { min: 90, max: 140 },
    wins: { min: 15, max: 25 },
    md5Package: { min: 120, max: 200 },
    md5Equivalent: { min: 24, max: 40 },
    coaching: { min: 80, max: 120 },
  },
  {
    tier: 'master',
    label: 'Mestre',
    shortLabel: 'Me',
    crest: 'M',
    stepType: 'single',
    solo: { min: 100, max: 180, plus: true },
    duo: { min: 180, max: 320, plus: true },
    wins: { min: 25, max: 40, plus: true },
    md5Package: { min: 200, max: 300, plus: true },
    md5Equivalent: { min: 40, max: 60, plus: true },
    coaching: { min: 100, max: 150, plus: true },
  },
  {
    tier: 'grandmaster',
    label: 'Grão-Mestre',
    shortLabel: 'GM',
    crest: 'G',
    stepType: 'single',
    solo: { min: 160, max: 240, plus: true },
    duo: { min: 280, max: 420, plus: true },
    wins: { min: 40, max: 52, plus: true },
    md5Package: { min: 280, max: 360, plus: true },
    md5Equivalent: { min: 56, max: 72, plus: true },
    coaching: { min: 140, max: 180, plus: true },
  },
  {
    tier: 'challenger',
    label: 'Desafiante',
    shortLabel: 'Ch',
    crest: 'C',
    stepType: 'single',
    solo: { min: 220, max: 300, plus: true },
    duo: { min: 380, max: 500, plus: true },
    wins: { min: 50, max: 60, plus: true },
    md5Package: { min: 340, max: 400, plus: true },
    md5Equivalent: { min: 68, max: 80, plus: true },
    coaching: { min: 170, max: 200, plus: true },
  },
  {
    tier: 'sovereign',
    label: 'Soberano',
    shortLabel: 'So',
    crest: 'S',
    stepType: 'single',
    solo: { min: 260, max: 360, plus: true },
    duo: { min: 430, max: 560, plus: true },
    wins: { min: 55, max: 70, plus: true },
    md5Package: { min: 380, max: 460, plus: true },
    md5Equivalent: { min: 76, max: 92, plus: true },
    coaching: { min: 190, max: 230, plus: true },
  },
]

// Apply optional multipliers from environment to adjust prices without editing code.
const emeraldMultiplier = Number((import.meta.env?.VITE_PRICE_MULTIPLIER_EMERALD ?? '1')) || 1

function applyMultiplierToRange(range: PriceRange, multiplier: number): PriceRange {
  return {
    ...range,
    min: Math.max(0, Math.round(range.min * multiplier)),
    max: Math.max(0, Math.round(range.max * multiplier)),
    plus: range.plus,
  }
}

const adjustedPriceTable = priceTable.map((row) => {
  if (row.tier !== 'emerald' || emeraldMultiplier === 1) {
    return row
  }

  return {
    ...row,
    solo: applyMultiplierToRange(row.solo, emeraldMultiplier),
    duo: applyMultiplierToRange(row.duo, emeraldMultiplier),
    wins: applyMultiplierToRange(row.wins, emeraldMultiplier),
    md5Package: applyMultiplierToRange(row.md5Package, emeraldMultiplier),
    md5Equivalent: applyMultiplierToRange(row.md5Equivalent, emeraldMultiplier),
    coaching: applyMultiplierToRange(row.coaching, emeraldMultiplier),
  }
})

// Runtime-adjustable price table: can be replaced by admin-provided pricing
let runtimeAdjustedPriceTable: RankPriceRow[] = adjustedPriceTable

let rowByTier = Object.fromEntries(runtimeAdjustedPriceTable.map((row) => [row.tier, row])) as Record<RankTier, RankPriceRow>

export function setRuntimePricingTable(rows?: RankPriceRow[]) {
  runtimeAdjustedPriceTable = Array.isArray(rows) && rows.length ? rows : adjustedPriceTable
  rowByTier = Object.fromEntries(runtimeAdjustedPriceTable.map((row) => [row.tier, row])) as Record<RankTier, RankPriceRow>
}

export function getRuntimePriceTable() {
  return runtimeAdjustedPriceTable
}

const rankedProgression: ProgressionStep[] = [
  ...divisionalRankTiers.flatMap((tier) =>
    rankDivisions.map((division) => ({
      key: `${tier}-${division}`,
      tier,
      division,
    })),
  ),
  ...apexRankTiers.map((tier) => ({
    key: tier,
    tier,
  })),
]

const progressionIndexByKey = Object.fromEntries(
  rankedProgression.map((step, index) => [step.key, index]),
) as Record<string, number>

const eloHighBoostStepPrices: Partial<Record<string, number>> = {
  iron: 12,
  bronze: 14,
  silver: 19,
  gold: 24,
  platinum: 34,
  emerald: 67,
  'diamond-IV': 100,
  'diamond-III': 109,
  'diamond-II': 119,
  'diamond-I': 139,
  master: 1700,
  grandmaster: 2500,
}

const eloHighQuoteDiscount = 50

const eloHighBoostStepDays: Partial<Record<string, number>> = {
  iron: 1,
  bronze: 1,
  silver: 1,
  gold: 1,
  platinum: 1,
  emerald: 1,
  'emerald-I': 2,
  'diamond-IV': 2,
  'diamond-III': 2,
  'diamond-II': 2,
  'diamond-I': 3,
  master: 15,
  grandmaster: 25,
}

export function getPriceRow(tier: RankTier) {
  return rowByTier[tier]
}

export function getGameTiers(game: GameKey) {
  return gameCatalog[game].tiers
}

export function getGameLabel(game: GameKey) {
  return gameCatalog[game].label
}

export function isApexTier(tier: RankTier): tier is ApexRankTier {
  return apexRankTiers.includes(tier as ApexRankTier)
}

export function formatRangeLabel(range: PriceRange) {
  return `R$ ${range.min} - ${range.max}${range.plus ? '+' : ''}`
}

export function getFixedPriceValue(range: PriceRange) {
  return roundSuggested(range.min, range.max)
}

export function getEloHighBoostReferenceLabel(tier: RankTier) {
  if (tier === 'diamond') {
    const diamondValues = rankDivisions
      .map((division) => eloHighBoostStepPrices[`diamond-${division}`])
      .filter((value): value is number => typeof value === 'number')

    if (diamondValues.length) {
      return `R$ ${Math.min(...diamondValues)} - ${Math.max(...diamondValues)}`
    }
  }

  const tierValue = eloHighBoostStepPrices[tier]

  if (typeof tierValue === 'number') {
    return `R$ ${tierValue}`
  }

  if (isApexTier(tier)) {
    return 'Sob consulta'
  }

  return `R$ ${getFixedPriceValue(getPriceRow(tier).solo)}`
}

export function formatTierDivision(tier: RankTier, division?: RankDivision) {
  const row = getPriceRow(tier)

  if (isApexTier(tier)) {
    return row.label
  }

  return `${row.label} ${division ?? 'IV'}`
}

export function formatTierSubtitle(tier: RankTier, division?: RankDivision) {
  if (isApexTier(tier)) {
    return 'Tier apex - divisão única'
  }

  return `Divisão ${division ?? 'IV'}`
}

function getProgressionKey(tier: RankTier, division?: RankDivision) {
  return isApexTier(tier) ? tier : `${tier}-${division ?? 'IV'}`
}

function getProgressionIndex(tier: RankTier, division?: RankDivision) {
  return progressionIndexByKey[getProgressionKey(tier, division)] ?? -1
}

function getBoostEstimatedDays(startIndex: number, targetIndex: number) {
  let estimatedDays = 0

  for (let stepIndex = startIndex; stepIndex < targetIndex; stepIndex += 1) {
    const step = rankedProgression[stepIndex]
    estimatedDays += eloHighBoostStepDays[step.key] ?? eloHighBoostStepDays[step.tier] ?? 1
  }

  return Math.max(1, estimatedDays)
}

function getEloHighBoostStepPrice(step: ProgressionStep) {
  return eloHighBoostStepPrices[step.key] ?? eloHighBoostStepPrices[step.tier] ?? getFixedPriceValue(getPriceRow(step.tier).solo)
}

function roundSuggested(min: number, max: number) {
  return Math.round((min + max) / 2)
}

export function createBoostQuote(input: {
  mode: Extract<PriceMode, 'solo' | 'duo' | 'flex'>
  currentTier: RankTier
  currentDivision: RankDivision
  targetTier: RankTier
  targetDivision: RankDivision
}): BoostQuote | null {
  const startIndex = getProgressionIndex(input.currentTier, input.currentDivision)
  const targetIndex = getProgressionIndex(input.targetTier, input.targetDivision)

  if (startIndex < 0 || targetIndex <= startIndex) {
    return null
  }

  let minTotal = 0
  let maxTotal = 0

  for (let stepIndex = startIndex; stepIndex < targetIndex; stepIndex += 1) {
    const step = rankedProgression[stepIndex]
    const stepPrice = getEloHighBoostStepPrice(step)
    minTotal += stepPrice
    maxTotal += stepPrice
  }

  minTotal = minTotal > eloHighQuoteDiscount ? minTotal - eloHighQuoteDiscount : minTotal
  maxTotal = maxTotal > eloHighQuoteDiscount ? maxTotal - eloHighQuoteDiscount : maxTotal

  const divisionCount = targetIndex - startIndex
  const touchesApex = isApexTier(input.currentTier) || isApexTier(input.targetTier)
  const unitLabel = touchesApex
    ? divisionCount === 1
      ? 'etapa'
      : 'etapas'
    : divisionCount === 1
      ? 'divisão'
      : 'divisões'
  const ladderText = `${formatTierDivision(input.currentTier, input.currentDivision)} -> ${formatTierDivision(input.targetTier, input.targetDivision)}`

  return {
    minTotal,
    maxTotal,
    suggestedTotal: roundSuggested(minTotal, maxTotal),
    divisionCount,
    estimatedDays: getBoostEstimatedDays(startIndex, targetIndex),
    summary: `${divisionCount} ${unitLabel} no ${input.mode === 'solo' ? 'solo boost' : input.mode === 'duo' ? 'duo boost' : 'flex boost'}`,
    ladderText,
  }
}

export function createUnitQuote(input: {
  mode: Extract<PriceMode, 'wins' | 'md5' | 'coaching'>
  tier: RankTier
  quantity: number
}): UnitQuote {
  const safeQuantity = Math.max(1, Math.min(10, Math.floor(input.quantity || 1)))
  const row = getPriceRow(input.tier)
  const range =
    input.mode === 'wins'
      ? row.wins
      : input.mode === 'md5'
        ? row.md5Package
        : row.coaching

  const minTotal = range.min * safeQuantity
  const maxTotal = range.max * safeQuantity

  const unitLabel =
    input.mode === 'wins'
      ? `${safeQuantity} vitória${safeQuantity > 1 ? 's' : ''}`
      : input.mode === 'md5'
        ? `${safeQuantity} pacote${safeQuantity > 1 ? 's' : ''} de MD5`
        : `${safeQuantity} hora${safeQuantity > 1 ? 's' : ''} de coaching`

  return {
    minTotal,
    maxTotal,
    suggestedTotal: roundSuggested(minTotal, maxTotal),
    quantity: safeQuantity,
    summary: unitLabel,
    ladderText: `${row.label} base`,
  }
}

export function getModeMeta(mode: PriceMode) {
  return {
    solo: {
      label: 'Solo Boost',
      serviceType: 'solo_boost_division',
      shortDescription: 'Subida por rota completa, calculada pelo ponto de partida.',
    },
    duo: {
      label: 'Duo Boost',
      serviceType: 'duo_boost_division',
      shortDescription: 'Você joga junto e o valor acompanha cada etapa da rota.',
    },
    flex: {
      label: 'Flex Boost',
      serviceType: 'flex_boost_division',
      shortDescription: 'Subida na fila Flex com base nos valores de mercado ajustados.',
    },
    wins: {
      label: 'Wins',
      serviceType: 'wins_by_rank',
      shortDescription: 'Pacote rápido de vitórias com base no elo selecionado.',
    },
    md5: {
      label: 'MD5',
      serviceType: 'md5_package',
      shortDescription: 'Feche um bloco de 5 partidas usando a faixa do elo base.',
    },
    coaching: {
      label: 'Coaching',
      serviceType: 'coaching_hour',
      shortDescription: 'Sessão por hora para review, macro e leitura de jogo.',
    },
  }[mode]
}
