import type { AuthUser, BoosterProfile, UserRole } from '@/types/auth'

export interface DashboardResponse<T = Record<string, unknown>> {
  data: T
}

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}

export interface ServiceOrder {
  id: number
  service_type: string
  title: string
  description?: string | null
  status: string
  price: string
  currency: string
  customer?: AuthUser | null
  booster?: AuthUser | null
}

export interface PaymentTransaction {
  id: number
  provider: 'stripe' | 'mercado_pago' | 'manual'
  method: 'pix' | 'card'
  direction: string
  amount: string
  currency: string
  status: string
  provider_reference?: string | null
  service_order?: ServiceOrder | null
}

export interface WithdrawalRequest {
  id: number
  amount: string
  method: 'pix' | 'card'
  pix_key?: string | null
  status: string
  notes?: string | null
  rejection_reason?: string | null
  booster?: AuthUser | null
  reviewer?: AuthUser | null
}

export interface TournamentRosterPlayer {
  nick: string
  riot_id: string
  role?: string | null
  rank?: string | null
  discord?: string | null
}

export interface TournamentRegistration {
  id: number
  user_id: number
  game: 'lol' | 'wild_rift'
  category_id: string
  category_title: string
  status: 'pending' | 'approved' | 'rejected' | 'checked_in'
  team_name: string
  team_tag: string
  captain_name: string
  captain_email: string
  captain_phone?: string | null
  captain_discord: string
  server: string
  team_discord?: string | null
  how_found?: string | null
  roster: TournamentRosterPlayer[]
  notes?: string | null
  accepted_rules: boolean
  accepted_check_in: boolean
  submitted_at: string
  created_at: string
  updated_at: string
  user?: AuthUser | null
}

export interface AdminTournamentSummary {
  total: number
  teams: number
  pending: number
  lol: number
  wild_rift: number
}

export interface AdminTournamentRegistrationsResponse {
  summary: AdminTournamentSummary
  registrations: Paginated<TournamentRegistration>
}

export interface BoosterApplication extends BoosterProfile {
  id: number
  user_id: number
  reviewed_by?: number | null
  status: 'pending' | 'approved' | 'rejected'
  review_notes?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  user?: AuthUser | null
}

export interface MasterDashboard {
  summary: Record<string, number>
  global_goals: Record<string, number>
  users_by_role: Partial<Record<UserRole, number>>
  latest_users: AuthUser[]
  pending_withdrawal_requests: WithdrawalRequest[]
}

export interface StaffDashboard {
  profile: {
    staff_profile?: string | null
    permissions: string[]
  }
  operation: {
    active_orders: number
    active_boosters: number
    recent_orders: ServiceOrder[]
  }
  finance: {
    pending_withdrawals: number
    pending_transactions: number
    month_revenue: number
  }
}

export interface BoosterDashboard {
  assigned_orders: ServiceOrder[]
  progress: {
    completed_orders: number
    active_orders: number
  }
  earnings: {
    available: number
    pending_withdrawals: number
  }
  goals: Record<string, number>
}

export interface CustomerDashboard {
  orders: ServiceOrder[]
  payments: PaymentTransaction[]
  history: {
    total_orders: number
    completed_orders: number
  }
}

export interface UsersResponse {
  users: Paginated<AuthUser>
  roles: Array<{ value: UserRole; label: string }>
  staff_profiles: Array<{ value: string; label: string }>
}
