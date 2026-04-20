export type BoosterStatus = 'online' | 'in_match'
export type ThemeVariant = 'mono' | 'crimson'

export interface UpcomingService {
  id: string
  customer: string
  queue: string
  scheduleLabel: string
  notes: string
}

export interface EarningsSnapshot {
  total: number
  delta: number
  series: number[]
  note: string
}

export interface DashboardOverview {
  headline: string
  status: BoosterStatus
  monthlyGoal: number
  monthEarnings: EarningsSnapshot
  upcomingServices: UpcomingService[]
}
