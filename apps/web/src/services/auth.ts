import axios from 'axios'

import { apiClient } from '@/services/api/client'
import { useSessionStore } from '@/store/useSessionStore'
import type { AuthResponse, AuthUser, MeResponse } from '@/types/auth'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  password_confirmation: string
}

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials)

    useSessionStore.getState().setSession(response.data)

    return response.data.data.user
  },

  async register(credentials: RegisterCredentials): Promise<void> {
    await apiClient.post('/auth/register', credentials)
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
        await axios.post(
          '/api/auth/logout',
          {
            refresh_token: refreshToken,
          },
          {
            headers: JSON_HEADERS,
          },
        )
      }
    } finally {
      clearSession()
    }
  },
}
