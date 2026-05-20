import { apiClient } from '@/services/api/client'
import { useSessionStore } from '@/store/useSessionStore'
import type { AuthResponse, AuthUser, MeResponse, SecurityTokenPreview } from '@/types/auth'

export interface LoginCredentials {
  email: string
  password: string
  two_factor_code?: string
}

export class TwoFactorRequiredError extends Error {
  public readonly security?: SecurityTokenPreview

  constructor(message: string, security?: SecurityTokenPreview) {
    super(message)
    this.name = 'TwoFactorRequiredError'
    this.security = security
  }
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface ResetPasswordPayload {
  email: string
  token: string
  password: string
  password_confirmation: string
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials)

    if ('requires_two_factor' in response.data && response.data.requires_two_factor) {
      throw new TwoFactorRequiredError(
        response.data.message ?? 'Confirme o código enviado para seu e-mail.',
        response.data.data?.security,
      )
    }

    useSessionStore.getState().setSession(response.data)

    if (!response.data.data.user) {
      throw new Error('Resposta de login sem usuário autenticado.')
    }

    return response.data.data.user
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', credentials)

    useSessionStore.getState().setSession(response.data)

    return response.data
  },

  async requestPasswordReset(email: string): Promise<string> {
    const response = await apiClient.post<{ message: string }>('/auth/password/forgot', { email })

    return response.data.message
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<string> {
    const response = await apiClient.post<{ message: string }>('/auth/password/reset', payload)

    return response.data.message
  },

  async fetchMe(): Promise<AuthUser> {
    const response = await apiClient.get<MeResponse>('/me')

    useSessionStore.getState().setUser(response.data.data.user)

    return response.data.data.user
  },

  async logout(): Promise<void> {
    const { refreshToken, clearSession } = useSessionStore.getState()

    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', {
          refresh_token: refreshToken,
        })
      }
    } finally {
      clearSession()
    }
  },
}
