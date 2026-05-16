import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

import { useSessionStore } from '@/store/useSessionStore'
import type { AuthResponse } from '@/types/auth'

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const

const configuredApiUrl = import.meta.env.VITE_API_URL
const invalidApiUrlValues = new Set(['', 'undefined', 'null'])
const productionApiUrl = 'https://api.horizonboost.com.br/api'

function resolveApiBaseUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return productionApiUrl
  }

  const normalized = value.trim()

  if (invalidApiUrlValues.has(normalized.toLowerCase()) || normalized.includes('api.boosthorizon.com')) {
    return productionApiUrl
  }

  return normalized.replace(/\/$/, '')
}

export const API_BASE_URL = resolveApiBaseUrl(configuredApiUrl)

if (import.meta.env.DEV) {
  console.debug('[api] baseURL', API_BASE_URL)
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: JSON_HEADERS,
})

let refreshPromise: Promise<string | null> | null = null

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().accessToken

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const requestConfig = error.config as RetriableConfig | undefined
    const isAuthenticationFailure = error.response?.status === 401
    const isAuthEndpoint =
      requestConfig?.url?.includes('/auth/login') ||
      requestConfig?.url?.includes('/auth/refresh') ||
      requestConfig?.url?.includes('/auth/logout')

    if (
      !requestConfig ||
      !isAuthenticationFailure ||
      requestConfig._retry ||
      isAuthEndpoint
    ) {
      throw error
    }

    requestConfig._retry = true

    const accessToken = await refreshAccessToken()

    if (!accessToken) {
      useSessionStore.getState().clearSession()
      throw error
    }

    return apiClient.request({
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    } satisfies AxiosRequestConfig)
  },
)

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

async function performRefresh(): Promise<string | null> {
  const { refreshToken, clearSession, setSession } = useSessionStore.getState()

  if (!refreshToken) {
    return null
  }

  try {
    const response = await axios.post<AuthResponse>(
      `${API_BASE_URL}/auth/refresh`,
      {
        refresh_token: refreshToken,
      },
      {
        headers: JSON_HEADERS,
      },
    )

    setSession(response.data)

    return response.data.access_token
  } catch {
    clearSession()

    return null
  }
}
