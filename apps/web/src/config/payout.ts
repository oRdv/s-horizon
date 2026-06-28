const fallbackBoosterPayoutPercent = 60

function configuredBoosterPayoutPercent() {
  const rawValue = import.meta.env.VITE_BOOSTER_PAYOUT_PERCENT ?? String(fallbackBoosterPayoutPercent)
  const numericValue = Number(rawValue)

  if (!Number.isFinite(numericValue)) {
    return fallbackBoosterPayoutPercent
  }

  return Math.max(0, Math.min(100, numericValue))
}

export const boosterPayoutRate = configuredBoosterPayoutPercent() / 100

export function getBoosterPayoutAmount(value?: number | string | null) {
  return Number(value ?? 0) * boosterPayoutRate
}
