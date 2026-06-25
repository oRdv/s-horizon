export type UserRole = 'master_admin' | 'staff' | 'booster' | 'customer'
export type StaffProfile = 'operations' | 'finance'

export interface BoosterProfile {
  id?: number
  full_name?: string | null
  birth_date?: string | null
  age?: number | null
  cpf?: string | null
  pix_key?: string | null
  gender?: string | null
  in_game_nick?: string | null
  highest_rank?: string | null
  previous_season_rank?: string | null
  available_hours?: string | null
  location?: string | null
  accepts_riot_responsibility?: boolean
  accepts_confidentiality_terms?: boolean
  initial_percentage?: string | number | null
  accepts_initial_percentage?: boolean
  opgg_url?: string | null
  discord_username?: string | null
  discord_user_id?: string | null
  diamond_plus_eta?: string | null
  accepts_cashflow_decay?: boolean
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: UserRole
  role_label?: string
  staff_profile?: StaffProfile | null
  booster_profile?: BoosterProfile | null
  effective_permissions?: string[]
  is_active?: boolean
  email_verified_at?: string | null
  two_factor_enabled?: boolean
  profile_photo_path?: string | null
  created_at?: string
  updated_at?: string
}

export interface SecurityTokenPreview {
  token_sent: boolean
  dev_token?: string
}

export interface AuthResponse {
  data: {
    user?: AuthUser
    email_verification?: SecurityTokenPreview
    security?: SecurityTokenPreview
  }
  access_token?: string
  refresh_token?: string
  token_type?: 'Bearer'
  expires_in?: number
  refresh_expires_in?: number
  message?: string
  requires_two_factor?: boolean
}

export interface MeResponse {
  data: {
    user: AuthUser
  }
}
