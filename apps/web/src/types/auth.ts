export interface AuthUser {
  id: number
  name: string
  email: string
  role?: string
}

export interface AuthResponse {
  data: {
    user: AuthUser
  }
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_expires_in: number
}

export interface MeResponse {
  data: {
    user: AuthUser
  }
}
