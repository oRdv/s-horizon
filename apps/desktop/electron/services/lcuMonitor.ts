import axios from 'axios'
import https from 'node:https'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  CurrentMatchState,
  LeagueClientStatus,
  MatchReportPayload,
  MatchResult,
} from '../../shared/types.js'

interface LockfileCredentials {
  port: string
  password: string
}

interface CurrentSummoner {
  puuid?: string
  summonerId?: number
}

type LcuRecord = Record<string, unknown>

interface ResolvedMatchResult {
  externalMatchId: string | null
  result: MatchResult
  duration: number
  timestamp: string
}

interface MonitorCallbacks {
  onStateChange: (payload: {
    leagueClient: LeagueClientStatus
    currentMatch: CurrentMatchState
    lastError: string | null
  }) => void
  onMatchFinished: (payload: MatchReportPayload) => Promise<void>
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

const emptyMatchState: CurrentMatchState = {
  active: false,
  gameTimeSeconds: 0,
  gameMode: null,
  mapName: null,
  startedAt: null,
  externalMatchId: null,
}

export class LcuMonitor {
  private timer: NodeJS.Timeout | null = null
  private leagueClient: LeagueClientStatus = 'disconnected'
  private currentMatch: CurrentMatchState = { ...emptyMatchState }
  private lastSubmissionKey: string | null = null

  constructor(private readonly callbacks: MonitorCallbacks) {}

  start(): void {
    if (this.timer) {
      return
    }

    void this.tick()
    this.timer = setInterval(() => {
      void this.tick()
    }, 5000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    const lockfile = await this.findLockfile()

    if (!lockfile) {
      this.leagueClient = 'disconnected'
      this.currentMatch = { ...emptyMatchState }
      this.publishState(null)
      return
    }

    const liveGame = await this.fetchLiveGame()

    if (liveGame) {
      const liveGameData = readRecord(liveGame.gameData)

      this.leagueClient = 'in_match'
      this.currentMatch = {
        active: true,
        gameTimeSeconds: Math.max(
          1,
          Math.floor(
            readNumber(
              liveGameData?.gameTime ?? liveGame.gameTime,
            ) ?? 0,
          ),
        ),
        gameMode: readString(liveGameData?.gameMode ?? liveGame.gameMode),
        mapName: readString(liveGameData?.mapName ?? liveGame.mapName),
        startedAt: this.currentMatch.startedAt ?? new Date().toISOString(),
        externalMatchId:
          readString(liveGameData?.gameId ?? liveGame.gameId) ??
          this.currentMatch.externalMatchId,
      }

      this.publishState(null)
      return
    }

    if (this.currentMatch.active) {
      try {
        const resolvedResult = await this.resolveFinishedMatch(lockfile)
        const report = buildMatchReport(this.currentMatch, resolvedResult)
        const submissionKey = report.external_match_id ?? report.timestamp

        this.leagueClient = 'lcu_ready'
        this.currentMatch = { ...emptyMatchState }
        this.publishState(null)

        if (submissionKey !== this.lastSubmissionKey) {
          this.lastSubmissionKey = submissionKey
          await this.callbacks.onMatchFinished(report)
        }
      } catch (error) {
        this.leagueClient = 'lcu_ready'
        this.currentMatch = { ...emptyMatchState }
        this.publishState(toErrorMessage(error))
      }

      return
    }

    this.leagueClient = 'lcu_ready'
    this.currentMatch = { ...emptyMatchState }
    this.publishState(null)
  }

  private publishState(lastError: string | null): void {
    this.callbacks.onStateChange({
      leagueClient: this.leagueClient,
      currentMatch: { ...this.currentMatch },
      lastError,
    })
  }

  private async findLockfile(): Promise<LockfileCredentials | null> {
    const candidatePaths = [
      path.join('C:\\Riot Games\\League of Legends', 'lockfile'),
      path.join(process.env.LOCALAPPDATA ?? '', 'Riot Games', 'Riot Client', 'Config', 'lockfile'),
      path.join(process.env.PROGRAMFILES ?? '', 'Riot Games', 'League of Legends', 'lockfile'),
      path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Riot Games', 'League of Legends', 'lockfile'),
    ].filter(Boolean)

    for (const candidatePath of candidatePaths) {
      try {
        await access(candidatePath)
        const content = await readFile(candidatePath, 'utf8')
        const [, , port, password] = content.trim().split(':')

        if (port && password) {
          return { port, password }
        }
      } catch {
        continue
      }
    }

    return null
  }

  private async fetchLiveGame(): Promise<LcuRecord | null> {
    try {
      const response = await axios.get<LcuRecord>(
        'https://127.0.0.1:2999/liveclientdata/allgamedata',
        {
          httpsAgent,
          timeout: 1500,
        },
      )

      return response.data
    } catch {
      return null
    }
  }

  private async resolveFinishedMatch(
    lockfile: LockfileCredentials,
  ): Promise<ResolvedMatchResult> {
    const currentSummoner = await this.fetchCurrentSummoner(lockfile)
    const fromHistory = await this.tryMatchHistory(lockfile, currentSummoner)

    if (fromHistory) {
      return fromHistory
    }

    const fromEndOfGame = await this.tryEndOfGame(lockfile)

    if (fromEndOfGame) {
      return fromEndOfGame
    }

    throw new Error('Não foi possível resolver o resultado da última partida no LCU.')
  }

  private async fetchCurrentSummoner(
    lockfile: LockfileCredentials,
  ): Promise<CurrentSummoner | null> {
    try {
      const response = await this.requestLcu<LcuRecord>(
        lockfile,
        '/lol-summoner/v1/current-summoner',
      )

      return {
        puuid: readString(response.data.puuid) ?? undefined,
        summonerId: readNumber(response.data.summonerId) ?? undefined,
      }
    } catch {
      return null
    }
  }

  private async tryMatchHistory(
    lockfile: LockfileCredentials,
    currentSummoner: CurrentSummoner | null,
  ): Promise<ResolvedMatchResult | null> {
    const endpoints = [
      '/lol-match-history/v1/products/lol/current-summoner/matches',
      '/lol-match-history/v1/games',
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await this.requestLcu<LcuRecord>(lockfile, endpoint)
        const games = extractGames(response.data)
        const selectedGame = selectRelevantGame(games, currentSummoner, this.currentMatch.externalMatchId)

        if (!selectedGame) {
          continue
        }

        const resolvedResult = extractResolvedResult(selectedGame, currentSummoner)

        if (resolvedResult) {
          return resolvedResult
        }
      } catch {
        continue
      }
    }

    return null
  }

  private async tryEndOfGame(
    lockfile: LockfileCredentials,
  ): Promise<ResolvedMatchResult | null> {
    try {
      const response = await this.requestLcu<LcuRecord>(
        lockfile,
        '/lol-end-of-game/v1/eog-stats-block',
      )

      const container = readRecord(response.data.data) ?? response.data
      const result = readBoolean(
        container.localPlayerWon ??
          container.localPlayerVictory ??
          container.gameEndedInWin,
      )

      if (result === null) {
        return null
      }

      return {
        externalMatchId: readString(container.gameId),
        result: result ? 'win' : 'loss',
        duration:
          normalizeDuration(
            readNumber(
              container.gameLength ??
                container.gameLengthSeconds ??
                container.gameDuration,
            ),
          ) ?? this.currentMatch.gameTimeSeconds,
        timestamp: normalizeTimestamp(
          container.gameEndedAt ?? container.gameEndTimestamp ?? Date.now(),
        ),
      }
    } catch {
      return null
    }
  }

  private async requestLcu<T>(
    lockfile: LockfileCredentials,
    endpoint: string,
  ): Promise<{ data: T }> {
    const response = await axios.get<T>(`https://127.0.0.1:${lockfile.port}${endpoint}`, {
      auth: {
        username: 'riot',
        password: lockfile.password,
      },
      httpsAgent,
      timeout: 2500,
    })

    return {
      data: response.data,
    }
  }
}

function extractGames(payload: LcuRecord): LcuRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }

  const gamesContainer = readRecord(payload.games)
  const candidates = [
    payload.games,
    gamesContainer?.games,
    payload.matches,
    payload.matchHistory,
  ]

  for (const candidate of candidates) {
    const games = readRecordArray(candidate)

    if (games) {
      return games
    }
  }

  return []
}

function selectRelevantGame(
  games: LcuRecord[],
  currentSummoner: CurrentSummoner | null,
  currentMatchId: string | null,
): LcuRecord | null {
  if (games.length === 0) {
    return null
  }

  if (currentMatchId) {
    const exactMatch = games.find((game) => extractExternalMatchId(game) === currentMatchId)

    if (exactMatch) {
      return exactMatch
    }
  }

  if (currentSummoner) {
    const withPlayer = games.find((game) => Boolean(findParticipant(game, currentSummoner)))

    if (withPlayer) {
      return withPlayer
    }
  }

  return games[0] ?? null
}

function extractResolvedResult(
  game: LcuRecord,
  currentSummoner: CurrentSummoner | null,
): ResolvedMatchResult | null {
  const participant = currentSummoner ? findParticipant(game, currentSummoner) : null
  const participantStats = readRecord(participant?.stats)
  const gameInfo = readRecord(game.info)
  const didWin = readBoolean(
    participant?.win ??
      participantStats?.win ??
      participant?.gameEndedInWin ??
      participant?.gameEndedInVictory ??
      participant?.isWinner ??
      game.localPlayerWon,
  )

  if (didWin === null) {
    return null
  }

  return {
    externalMatchId: extractExternalMatchId(game),
    result: didWin ? 'win' : 'loss',
    duration:
      normalizeDuration(
        readNumber(
          gameInfo?.gameDuration ??
            game.gameDuration ??
            game.gameLength ??
            game.gameLengthSeconds,
        ),
      ) ?? 0,
    timestamp: normalizeTimestamp(
      gameInfo?.gameEndTimestamp ??
        game.gameEndTimestamp ??
        game.gameCreation ??
        game.gameCreationDate ??
        Date.now(),
    ),
  }
}

function findParticipant(
  game: LcuRecord,
  currentSummoner: CurrentSummoner,
): LcuRecord | null {
  const gameInfo = readRecord(game.info)
  const participants =
    readRecordArray(gameInfo?.participants) ??
    readRecordArray(game.participants) ??
    []

  return (
    participants.find((participant) => {
      const player = readRecord(participant.player)
      const participantPuuid = readString(participant.puuid ?? player?.puuid)
      const participantSummonerId = readNumber(
        participant.summonerId ?? player?.summonerId,
      )

      return (
        (participantPuuid && participantPuuid === currentSummoner.puuid) ||
        (participantSummonerId !== null && participantSummonerId === currentSummoner.summonerId)
      )
    }) ?? null
  )
}

function extractExternalMatchId(game: LcuRecord): string | null {
  const metadata = readRecord(game.metadata)

  return (
    readString(metadata?.matchId) ??
    readString(game.gameId) ??
    readString(game.id)
  )
}

function normalizeDuration(value: number | null): number | null {
  if (value === null) {
    return null
  }

  if (value > 100000) {
    return Math.round(value / 1000)
  }

  return Math.round(value)
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'number') {
    const timestamp = value > 1000000000000 ? value : value * 1000

    return new Date(timestamp).toISOString()
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)

    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }

  return new Date().toISOString()
}

function buildMatchReport(
  currentMatch: CurrentMatchState,
  resolvedResult: ResolvedMatchResult,
): MatchReportPayload {
  return {
    external_match_id: resolvedResult.externalMatchId ?? currentMatch.externalMatchId ?? undefined,
    result: resolvedResult.result,
    duration: resolvedResult.duration || currentMatch.gameTimeSeconds,
    timestamp: resolvedResult.timestamp,
    source: 'desktop-app',
    payload: {
      gameMode: currentMatch.gameMode,
      mapName: currentMatch.mapName,
    },
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Falha desconhecida ao consultar o client.'
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isRecord(value: unknown): value is LcuRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown): LcuRecord | null {
  return isRecord(value) ? value : null
}

function readRecordArray(value: unknown): LcuRecord[] | null {
  return Array.isArray(value) ? value.filter(isRecord) : null
}
