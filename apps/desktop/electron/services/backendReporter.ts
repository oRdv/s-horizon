import axios from 'axios'
import https from 'node:https'

import type {
  DesktopOrder,
  DesktopSession,
  HeartbeatPayload,
  LoginPayload,
} from '../../shared/types.js'

interface AuthResponse {
  data: {
    user?: DesktopSession['user']
    security?: {
      dev_token?: string
    }
  }
  access_token?: string
  refresh_token?: string
  message?: string
  requires_two_factor?: boolean
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const

export class BackendReporter {
  private session: DesktopSession | null = null

  constructor(private readonly onSessionUpdate: (session: DesktopSession | null) => Promise<void>) {}

  setSession(session: DesktopSession | null): void {
    this.session = session
  }

  getSessionPreview(): Pick<DesktopSession, 'apiBaseUrl' | 'user'> | null {
    if (!this.session) {
      return null
    }

    return {
      apiBaseUrl: this.session.apiBaseUrl,
      user: this.session.user,
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.session?.accessToken)
  }

  async login(payload: LoginPayload): Promise<DesktopSession> {
    const apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl)
    const response = await axios.post<AuthResponse>(
      `${apiBaseUrl}/auth/login`,
      {
        email: payload.email,
        password: payload.password,
        two_factor_code: payload.twoFactorCode || undefined,
      },
      {
        headers: JSON_HEADERS,
        httpsAgent,
      },
    )

    if (response.data.requires_two_factor) {
      const devToken = response.data.data?.security?.dev_token
      throw new Error(
        devToken
          ? `Codigo de 2FA enviado. Ambiente local: use ${devToken}.`
          : response.data.message ?? 'Informe o codigo de 2FA enviado para seu email.',
      )
    }

    if (!response.data.access_token || !response.data.data.user) {
      throw new Error('Resposta de login incompleta. Tente entrar novamente.')
    }

    const session: DesktopSession = {
      apiBaseUrl,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      user: response.data.data.user,
    }

    this.session = session
    await this.onSessionUpdate(session)

    return session
  }

  async clear(): Promise<void> {
    this.session = null
    await this.onSessionUpdate(null)
  }

  async getOrders(): Promise<DesktopOrder[]> {
    const response = await this.authorizedRequest((token) =>
      axios.get<{ data: { orders: DesktopOrder[] } }>(`${this.requireSession().apiBaseUrl}/orders`, {
        headers: this.headers(token),
        httpsAgent,
      }),
    )

    return response.data.data.orders
  }

  async sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
    await this.authorizedRequest((token) =>
      axios.post(`${this.requireSession().apiBaseUrl}/booster-tracker/heartbeat`, payload, {
        headers: this.headers(token),
        httpsAgent,
      }),
    )
  }

  async sendMatchFinished(payload: Record<string, unknown>): Promise<void> {
    await this.authorizedRequest((token) =>
      axios.post(`${this.requireSession().apiBaseUrl}/booster-tracker/match-finished`, payload, {
        headers: this.headers(token),
        httpsAgent,
      }),
    )
  }

  private async authorizedRequest<T>(request: (token: string) => Promise<T>): Promise<T> {
    const session = this.requireSession()

    try {
      return await request(session.accessToken)
    } catch (error) {
      if (!shouldAttemptRefresh(error) || !session.refreshToken) {
        throw toUserError(error)
      }

      const refreshedToken = await this.refreshAccessToken()

      return request(refreshedToken)
    }
  }

  private async refreshAccessToken(): Promise<string> {
    const session = this.requireSession()

    if (!session.refreshToken) {
      throw new Error('Sessao expirada.')
    }

    const response = await axios.post<AuthResponse>(
      `${session.apiBaseUrl}/auth/refresh`,
      { refresh_token: session.refreshToken },
      {
        headers: JSON_HEADERS,
        httpsAgent,
      },
    )

    if (!response.data.access_token || !response.data.data.user) {
      throw new Error('Sessao nao renovada pelo backend.')
    }

    this.session = {
      apiBaseUrl: session.apiBaseUrl,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      user: response.data.data.user,
    }

    await this.onSessionUpdate(this.session)

    return this.session.accessToken
  }

  private requireSession(): DesktopSession {
    if (!this.session) {
      throw new Error('Faca login no app desktop.')
    }

    return this.session
  }

  private headers(token: string) {
    return {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    }
  }
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

function shouldAttemptRefresh(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

function toUserError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const message =
      typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : error.message

    return new Error(message)
  }

  return error instanceof Error ? error : new Error('Falha de comunicacao com o backend.')
}
