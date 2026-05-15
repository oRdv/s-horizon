const { app, BrowserWindow, ipcMain } = require('electron')
const axios = require('axios')
const https = require('node:https')
const { access, mkdir, readFile, rm, writeFile } = require('node:fs/promises')
const path = require('node:path')

let mainWindow = null

const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const sessionFile = path.join(app.getPath('userData'), 'horizon-boost-session.json')

let session = null
let currentState = {
  session: null,
  isAuthenticated: false,
  leagueClient: 'disconnected',
  activeOrderId: null,
  latestSnapshot: null,
  lastHeartbeatAt: null,
  lastError: null,
}

app.whenReady().then(async () => {
  session = await loadSession()
  updateState({
    session: session ? { apiBaseUrl: session.apiBaseUrl, user: session.user } : null,
    isAuthenticated: Boolean(session?.accessToken),
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#050304',
    title: 'Horizon Boost Tracker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.on('did-fail-load', (_event, _code, description, url) => {
    updateState({ lastError: `Falha ao carregar ${url}: ${description}` })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpcHandlers() {
  ipcMain.handle('horizon-boost:bootstrap', async () => currentState)

  ipcMain.handle('horizon-boost:login', async (_event, payload) => {
    const apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl)
    const response = await axios.post(`${apiBaseUrl}/auth/login`, {
      email: payload.email,
      password: payload.password,
    }, { headers: jsonHeaders(), httpsAgent })

    session = {
      apiBaseUrl,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      user: response.data.data.user,
    }
    await saveSession(session)

    updateState({
      session: { apiBaseUrl: session.apiBaseUrl, user: session.user },
      isAuthenticated: true,
      lastError: null,
    })

    return currentState
  })

  ipcMain.handle('horizon-boost:logout', async () => {
    session = null
    await clearSession()
    updateState({
      session: null,
      isAuthenticated: false,
      activeOrderId: null,
      lastError: null,
    })
    return currentState
  })

  ipcMain.handle('horizon-boost:get-orders', async () => {
    const response = await authorizedRequest((token) =>
      axios.get(`${session.apiBaseUrl}/orders`, { headers: authHeaders(token), httpsAgent }))

    return response.data.data.orders
  })

  ipcMain.handle('horizon-boost:lcu-snapshot', async () => {
    const snapshot = await readLcuSnapshot()
    updateState({
      latestSnapshot: snapshot,
      leagueClient: snapshot.clientOpen ? 'connected' : 'disconnected',
      lastError: snapshot.error,
    })
    return snapshot
  })

  ipcMain.handle('horizon-boost:heartbeat', async (_event, payload) => {
    await authorizedRequest((token) =>
      axios.post(`${session.apiBaseUrl}/booster-tracker/heartbeat`, payload, {
        headers: authHeaders(token),
        httpsAgent,
      }))

    updateState({
      activeOrderId: payload.orderId,
      lastHeartbeatAt: new Date().toISOString(),
      lastError: null,
    })

    return currentState
  })

  ipcMain.handle('horizon-boost:match-finished', async (_event, payload) => {
    await authorizedRequest((token) =>
      axios.post(`${session.apiBaseUrl}/booster-tracker/match-finished`, payload, {
        headers: authHeaders(token),
        httpsAgent,
      }))

    return currentState
  })
}

async function authorizedRequest(request) {
  if (!session?.accessToken) {
    throw new Error('Faca login no app desktop.')
  }

  try {
    return await request(session.accessToken)
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !session.refreshToken) {
      throw normalizeAxiosError(error)
    }

    const refresh = await axios.post(`${session.apiBaseUrl}/auth/refresh`, {
      refresh_token: session.refreshToken,
    }, { headers: jsonHeaders(), httpsAgent })

    session = {
      apiBaseUrl: session.apiBaseUrl,
      accessToken: refresh.data.access_token,
      refreshToken: refresh.data.refresh_token,
      user: refresh.data.data.user,
    }
    await saveSession(session)

    return request(session.accessToken)
  }
}

async function readLcuSnapshot() {
  const lockfile = await findLockfile()
  const capturedAt = new Date().toISOString()

  if (!lockfile) {
    return emptySnapshot(false, 'OFFLINE', capturedAt)
  }

  try {
    const [summoner, gameflow, champSelect, rankedStats] = await Promise.all([
      requestLcu(lockfile, '/lol-summoner/v1/current-summoner').catch(() => null),
      requestLcu(lockfile, '/lol-gameflow/v1/session').catch(() => null),
      requestLcu(lockfile, '/lol-champ-select/v1/session').catch(() => null),
      requestLcu(lockfile, '/lol-ranked/v1/current-ranked-stats').catch(() => null),
    ])
    const phase = readString(gameflow?.phase) || 'CLIENT_OPEN'

    return {
      clientOpen: true,
      status: mapGameflowToStatus(phase),
      gameflowPhase: phase,
      riotAccount: summoner ? {
        gameName: readString(summoner.gameName) || readString(summoner.displayName),
        tagLine: readString(summoner.tagLine),
        summonerName: readString(summoner.displayName) || readString(summoner.internalName),
        puuid: readString(summoner.puuid),
        region: process.env.RIOT_REGION || 'BR1',
      } : null,
      currentGame: extractCurrentGame(gameflow, champSelect),
      rankedProgress: extractRankedProgress(rankedStats),
      recentMatches: [],
      capturedAt,
      error: null,
    }
  } catch (error) {
    return {
      ...emptySnapshot(true, 'CLIENT_OPEN', capturedAt),
      error: error instanceof Error ? error.message : 'Falha ao ler o LCU.',
    }
  }
}

async function findLockfile() {
  const candidates = [
    process.env.LEAGUE_LOCKFILE_PATH,
    path.join('C:\\Riot Games\\League of Legends', 'lockfile'),
    path.join(process.env.PROGRAMFILES || '', 'Riot Games', 'League of Legends', 'lockfile'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Riot Games', 'League of Legends', 'lockfile'),
    path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'League of Legends', 'lockfile'),
    path.join(process.env.LOCALAPPDATA || '', 'Riot Games', 'Riot Client', 'Config', 'lockfile'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      await access(candidate)
      const content = await readFile(candidate, 'utf8')
      const [, , port, password, protocol] = content.trim().split(':')

      if (port && password) {
        return { port, password, protocol: protocol || 'https' }
      }
    } catch {
      continue
    }
  }

  return null
}

async function requestLcu(lockfile, endpoint) {
  const response = await axios.get(`${lockfile.protocol}://127.0.0.1:${lockfile.port}${endpoint}`, {
    auth: { username: 'riot', password: lockfile.password },
    httpsAgent,
    timeout: 2500,
  })

  return response.data
}

function extractCurrentGame(gameflow, champSelect) {
  const gameData = readRecord(gameflow?.gameData)
  const queue = readRecord(gameData?.queue)
  const sessionData = readRecord(gameflow?.gameClient)
  const championId = extractChampionId(champSelect)

  if (!gameData && !sessionData && !championId) {
    return null
  }

  return {
    gameId: readString(gameData?.gameId || gameflow?.gameId),
    queueId: readNumber(queue?.id || gameData?.queueId),
    championId,
    startedAt: sessionData?.running ? new Date().toISOString() : null,
  }
}

function extractChampionId(champSelect) {
  const localPlayerCellId = readNumber(champSelect?.localPlayerCellId)
  const myTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : []
  const player = myTeam.find((item) => readNumber(item.cellId) === localPlayerCellId) || myTeam[0]

  return readNumber(player?.championId)
}

function extractRankedProgress(rankedStats) {
  const queues = rankedStats?.queues || rankedStats?.queueMap
  const soloQueue = Array.isArray(queues)
    ? queues.find((queue) => queue.queueType === 'RANKED_SOLO_5x5') || queues[0]
    : queues?.RANKED_SOLO_5x5 || queues?.RANKED_FLEX_SR || null

  if (!soloQueue) {
    return null
  }

  return {
    tier: readString(soloQueue.tier),
    division: readString(soloQueue.division || soloQueue.rank),
    leaguePoints: readNumber(soloQueue.leaguePoints),
    queueType: readString(soloQueue.queueType) || 'RANKED_SOLO_5x5',
    wins: readNumber(soloQueue.wins),
    losses: readNumber(soloQueue.losses),
  }
}

function mapGameflowToStatus(phase) {
  if (['Lobby', 'Matchmaking', 'ReadyCheck'].includes(phase)) return 'IN_LOBBY'
  if (phase === 'ChampSelect') return 'IN_CHAMP_SELECT'
  if (phase === 'InProgress') return 'IN_GAME'
  if (['EndOfGame', 'PreEndOfGame', 'WaitingForStats'].includes(phase)) return 'GAME_ENDED'
  return 'CLIENT_OPEN'
}

function emptySnapshot(clientOpen, status, capturedAt) {
  return {
    clientOpen,
    status,
    gameflowPhase: null,
    riotAccount: null,
    currentGame: null,
    rankedProgress: null,
    recentMatches: [],
    capturedAt,
    error: null,
  }
}

async function loadSession() {
  try {
    return JSON.parse(await readFile(sessionFile, 'utf8'))
  } catch {
    return null
  }
}

async function saveSession(value) {
  await mkdir(path.dirname(sessionFile), { recursive: true })
  await writeFile(sessionFile, JSON.stringify(value, null, 2), 'utf8')
}

async function clearSession() {
  await rm(sessionFile, { force: true })
}

function updateState(patch) {
  currentState = { ...currentState, ...patch }
  mainWindow?.webContents.send('horizon-boost:state-changed', currentState)
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

function jsonHeaders() {
  return { Accept: 'application/json', 'Content-Type': 'application/json' }
}

function authHeaders(token) {
  return { ...jsonHeaders(), Authorization: `Bearer ${token}` }
}

function normalizeAxiosError(error) {
  if (axios.isAxiosError(error)) {
    return new Error(error.response?.data?.message || error.message)
  }

  return error instanceof Error ? error : new Error('Falha inesperada.')
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}
