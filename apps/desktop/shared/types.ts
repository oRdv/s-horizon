export interface DesktopSession {
  apiBaseUrl: string
  accessToken: string
  refreshToken?: string
  user?: DesktopUser
}

export interface DesktopUser {
  id: number
  name: string
  email: string
  role: string
}

export type TrackerStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'CLIENT_OPEN'
  | 'IN_LOBBY'
  | 'IN_CHAMP_SELECT'
  | 'IN_GAME'
  | 'GAME_ENDED'

export interface RiotAccountSnapshot {
  gameName?: string | null
  tagLine?: string | null
  summonerName?: string | null
  puuid?: string | null
  region?: string | null
}

export interface CurrentGameSnapshot {
  gameId?: string | null
  queueId?: number | null
  championId?: number | null
  startedAt?: string | null
}

export interface LcuSnapshot {
  clientOpen: boolean
  status: TrackerStatus
  gameflowPhase: string | null
  riotAccount: RiotAccountSnapshot | null
  currentGame: CurrentGameSnapshot | null
  rankedProgress: RankedProgressSnapshot | null
  recentMatches: DesktopTrackedMatch[]
  capturedAt: string
  error: string | null
}

export interface RankedProgressSnapshot {
  tier?: string | null
  division?: string | null
  leaguePoints?: number | null
  queueType?: string | null
  wins?: number | null
  losses?: number | null
}

export interface DesktopOrder {
  id: number
  title: string
  service_type: string
  status: string
  payment_status?: string | null
  metadata?: Record<string, unknown> | null
  customer?: {
    id: number
    name: string
    email: string
  } | null
  booster?: {
    id: number
    name: string
    email: string
  } | null
  tracker_status?: {
    status: TrackerStatus
    last_heartbeat_at: string | null
    riot_account?: RiotAccountSnapshot
    current_game?: CurrentGameSnapshot
    ranked_progress?: {
      snapshot?: RankedProgressSnapshot | null
      lpDelta?: number | null
      progressPercent?: number | null
    } | null
  } | null
}

export interface DesktopTrackedMatch {
  matchId?: string | null
  gameId?: string | null
  championId?: number | null
  queueId?: number | null
  result?: string | null
  durationSeconds?: number | null
  createdAt?: string | null
}

export interface MonitorState {
  session: Pick<DesktopSession, 'apiBaseUrl' | 'user'> | null
  isAuthenticated: boolean
  leagueClient: 'disconnected' | 'connected'
  activeOrderId: number | null
  latestSnapshot: LcuSnapshot | null
  lastHeartbeatAt: string | null
  lastError: string | null
  updates: UpdateState
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  availableVersion: string | null
  progress: number | null
  downloaded: boolean
  lastCheckedAt: string | null
  error: string | null
}

export interface LoginPayload {
  apiBaseUrl: string
  email: string
  password: string
  twoFactorCode?: string
}

export interface HeartbeatPayload {
  orderId: number
  status: TrackerStatus
  riotAccount?: RiotAccountSnapshot | null
  currentGame?: CurrentGameSnapshot | null
  rankedProgress?: RankedProgressSnapshot | null
}
