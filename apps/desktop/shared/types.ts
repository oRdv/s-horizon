export interface DesktopSession {
  apiBaseUrl: string
  accessToken: string
  refreshToken?: string
}

export type LeagueClientStatus = 'disconnected' | 'lcu_ready' | 'in_match'
export type MatchResult = 'win' | 'loss'

export interface CurrentMatchState {
  active: boolean
  gameTimeSeconds: number
  gameMode: string | null
  mapName: string | null
  startedAt: string | null
  externalMatchId: string | null
}

export interface LastReportState {
  status: 'sent' | 'failed'
  result: MatchResult
  duration: number
  timestamp: string
  externalMatchId: string | null
  sentAt: string
  error?: string
}

export interface MonitorState {
  session: Pick<DesktopSession, 'apiBaseUrl'> | null
  isAuthenticated: boolean
  leagueClient: LeagueClientStatus
  currentMatch: CurrentMatchState
  lastReport: LastReportState | null
  lastError: string | null
}

export interface MatchReportPayload {
  external_match_id?: string
  result: MatchResult
  duration: number
  timestamp: string
  source: 'desktop-app'
  payload?: Record<string, unknown>
}
