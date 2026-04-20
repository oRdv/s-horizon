import axios from 'axios'
import https from 'node:https'

import type { DesktopSession, MatchReportPayload } from '../../shared/types.js'

interface AuthResponse {
  access_token: string
  refresh_token: string
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

  constructor(
    private readonly onSessionUpdate: (session: DesktopSession | null) => Promise<void>,
  ) {}

  setSession(session: DesktopSession | null): void {
    this.session = session
  }

  getSessionPreview(): Pick<DesktopSession, 'apiBaseUrl'> | null {
    if (!this.session) {
      return null
    }

    return {
      apiBaseUrl: this.session.apiBaseUrl,
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.session?.accessToken)
  }

  async sendMatchReport(payload: MatchReportPayload): Promise<void> {
    if (!this.session) {
      throw new Error('Nenhuma sessão de backend foi configurada.')
    }

    try {
      await this.postMatchReport(this.session.accessToken, payload)
    } catch (error) {
      if (!shouldAttemptRefresh(error) || !this.session.refreshToken) {
        throw toUserError(error)
      }

      const refreshedToken = await this.refreshAccessToken()

      if (!refreshedToken) {
        throw toUserError(error)
      }

      await this.postMatchReport(refreshedToken, payload)
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.session?.refreshToken) {
      return null
    }

    const response = await axios.post<AuthResponse>(
      `${this.session.apiBaseUrl}/api/auth/refresh`,
      {
        refresh_token: this.session.refreshToken,
      },
      {
        headers: JSON_HEADERS,
        httpsAgent,
      },
    )

    this.session = {
      apiBaseUrl: this.session.apiBaseUrl,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    }

    await this.onSessionUpdate(this.session)

    return this.session.accessToken
  }

  private async postMatchReport(token: string, payload: MatchReportPayload): Promise<void> {
    if (!this.session) {
      return
    }

    await axios.post(`${this.session.apiBaseUrl}/api/matches`, payload, {
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      httpsAgent,
    })
  }
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

  if (error instanceof Error) {
    return error
  }

  return new Error('Falha desconhecida ao enviar a partida para o backend.')
}
