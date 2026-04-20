import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BackendReporter } from './services/backendReporter.js'
import { LcuMonitor } from './services/lcuMonitor.js'
import { SessionStore } from './services/sessionStore.js'
import type {
  DesktopSession,
  LastReportState,
  MatchReportPayload,
  MonitorState,
} from '../shared/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

const sessionStore = new SessionStore()

const baseState: MonitorState = {
  session: null,
  isAuthenticated: false,
  leagueClient: 'disconnected',
  currentMatch: {
    active: false,
    gameTimeSeconds: 0,
    gameMode: null,
    mapName: null,
    startedAt: null,
    externalMatchId: null,
  },
  lastReport: null,
  lastError: null,
}

let currentState: MonitorState = { ...baseState }

const reporter = new BackendReporter(async (session: DesktopSession | null) => {
  await sessionStore.save(session)
  updateState({
    session: session ? { apiBaseUrl: session.apiBaseUrl } : null,
    isAuthenticated: Boolean(session?.accessToken),
  })
})

const monitor = new LcuMonitor({
  onStateChange: ({ currentMatch, lastError, leagueClient }: {
    currentMatch: import('../shared/types.js').CurrentMatchState
    lastError: string | null
    leagueClient: import('../shared/types.js').LeagueClientStatus
  }) => {
    updateState({
      currentMatch,
      lastError,
      leagueClient,
    })
  },
  onMatchFinished: async (payload: MatchReportPayload) => {
    try {
      await reporter.sendMatchReport(payload)
      updateState({
        lastReport: buildReportState(payload, 'sent'),
        lastError: null,
      })
    } catch (error) {
      updateState({
        lastReport: buildReportState(payload, 'failed', toErrorMessage(error)),
        lastError: toErrorMessage(error),
      })
    }
  },
})

app.whenReady().then(async () => {
  const storedSession = await sessionStore.load()

  reporter.setSession(storedSession)
  updateState({
    session: storedSession ? { apiBaseUrl: storedSession.apiBaseUrl } : null,
    isAuthenticated: Boolean(storedSession?.accessToken),
  })

  registerIpcHandlers()
  createWindow()
  monitor.start()

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

app.on('before-quit', () => {
  monitor.stop()
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#050505',
    title: 'Horizon Boost Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

function registerIpcHandlers() {
  ipcMain.handle('horizon-boost:bootstrap', async () => currentState)

  ipcMain.handle('horizon-boost:save-session', async (_event, session: DesktopSession) => {
    const normalizedSession = {
      ...session,
      apiBaseUrl: session.apiBaseUrl.replace(/\/+$/, ''),
    }

    await sessionStore.save(normalizedSession)
    reporter.setSession(normalizedSession)

    updateState({
      session: { apiBaseUrl: normalizedSession.apiBaseUrl },
      isAuthenticated: true,
      lastError: null,
    })

    return currentState
  })

  ipcMain.handle('horizon-boost:clear-session', async () => {
    await sessionStore.clear()
    reporter.setSession(null)

    updateState({
      session: null,
      isAuthenticated: false,
      lastError: null,
    })

    return currentState
  })
}

function updateState(patch: Partial<MonitorState>) {
  currentState = {
    ...currentState,
    ...patch,
  }

  mainWindow?.webContents.send('horizon-boost:state-changed', currentState)
}

function buildReportState(
  payload: MatchReportPayload,
  status: LastReportState['status'],
  error?: string,
): LastReportState {
  return {
    status,
    result: payload.result,
    duration: payload.duration,
    timestamp: payload.timestamp,
    externalMatchId: payload.external_match_id ?? null,
    sentAt: new Date().toISOString(),
    error,
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Falha desconhecida ao sincronizar a ultima partida.'
}
