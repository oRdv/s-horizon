import electronMain from 'electron/main'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BackendReporter } from './services/backendReporter.js'
import { LcuMonitor } from './services/lcuMonitor.js'
import { SessionStore } from './services/sessionStore.js'
import type { LoginPayload, MonitorState, UpdateState } from '../shared/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const { app, BrowserWindow, ipcMain } = electronMain
const { autoUpdater } = electronUpdater

let mainWindow: BrowserWindowType | null = null

const sessionStore = new SessionStore()
const lcuMonitor = new LcuMonitor()

let currentState: MonitorState = {
  session: null,
  isAuthenticated: false,
  leagueClient: 'disconnected',
  activeOrderId: null,
  latestSnapshot: null,
  lastHeartbeatAt: null,
  lastError: null,
  updates: initialUpdateState(),
}

const reporter = new BackendReporter(async (session) => {
  await sessionStore.save(session)
  updateState({
    session: session ? { apiBaseUrl: session.apiBaseUrl, user: session.user } : null,
    isAuthenticated: Boolean(session?.accessToken),
  })
})

app.whenReady().then(async () => {
  const storedSession = await sessionStore.load()

  reporter.setSession(storedSession)
  updateState({
    session: storedSession ? { apiBaseUrl: storedSession.apiBaseUrl, user: storedSession.user } : null,
    isAuthenticated: Boolean(storedSession?.accessToken),
  })

  registerIpcHandlers()
  configureAutoUpdater()
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

  ipcMain.handle('horizon-boost:login', async (_event, payload: LoginPayload) => {
    const session = await reporter.login(payload)

    updateState({
      session: { apiBaseUrl: session.apiBaseUrl, user: session.user },
      isAuthenticated: true,
      lastError: null,
    })

    return currentState
  })

  ipcMain.handle('horizon-boost:logout', async () => {
    await reporter.clear()
    updateState({
      session: null,
      isAuthenticated: false,
      activeOrderId: null,
      lastError: null,
    })

    return currentState
  })

  ipcMain.handle('horizon-boost:get-orders', async () => reporter.getOrders())

  ipcMain.handle('horizon-boost:lcu-snapshot', async () => {
    const snapshot = await lcuMonitor.snapshot()

    updateState({
      latestSnapshot: snapshot,
      leagueClient: snapshot.clientOpen ? 'connected' : 'disconnected',
      lastError: snapshot.error,
    })

    return snapshot
  })

  ipcMain.handle('horizon-boost:heartbeat', async (_event, payload) => {
    await reporter.sendHeartbeat(payload)
    updateState({
      activeOrderId: payload.orderId,
      lastHeartbeatAt: new Date().toISOString(),
      lastError: null,
    })

    return currentState
  })

  ipcMain.handle('horizon-boost:match-finished', async (_event, payload) => {
    await reporter.sendMatchFinished(payload)
    return currentState
  })

  ipcMain.handle('horizon-boost:updates/check', async () => {
    assertUpdaterAvailable()

    try {
      updateState({
        updates: {
          ...currentState.updates,
          status: 'checking',
          error: null,
          lastCheckedAt: new Date().toISOString(),
        },
      })

      await autoUpdater.checkForUpdates()

      return currentState.updates
    } catch (error) {
      const message = normalizeUpdaterError(error)
      updateState({
        updates: {
          ...currentState.updates,
          status: 'error',
          error: message,
        },
      })
      throw new Error(message)
    }
  })

  ipcMain.handle('horizon-boost:updates/download', async () => {
    assertUpdaterAvailable()

    try {
      updateState({
        updates: {
          ...currentState.updates,
          status: 'downloading',
          error: null,
        },
      })

      await autoUpdater.downloadUpdate()

      return currentState.updates
    } catch (error) {
      const message = normalizeUpdaterError(error)
      updateState({
        updates: {
          ...currentState.updates,
          status: 'error',
          error: message,
        },
      })
      throw new Error(message)
    }
  })

  ipcMain.handle('horizon-boost:updates/install', async () => {
    assertUpdaterAvailable()

    if (!currentState.updates.downloaded) {
      throw new Error('Baixe a atualizacao antes de instalar.')
    }

    updateState({
      updates: {
        ...currentState.updates,
        status: 'installing',
        error: null,
      },
    })

    setImmediate(() => autoUpdater.quitAndInstall(false, true))

    return currentState.updates
  })
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  if (!app.isPackaged && process.env.HORIZON_TRACKER_ALLOW_DEV_UPDATES === 'true') {
    autoUpdater.forceDevUpdateConfig = true
  }

  const provider = process.env.HORIZON_TRACKER_UPDATE_PROVIDER
  const genericUrl = process.env.HORIZON_TRACKER_UPDATE_FEED_URL

  if (provider === 'generic' && genericUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: genericUrl })
  } else if (provider === 'github') {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: process.env.HORIZON_TRACKER_UPDATE_OWNER || 'oRdv',
      repo: process.env.HORIZON_TRACKER_UPDATE_REPO || 's-horizon',
    })
  }

  autoUpdater.on('checking-for-update', () => {
    updateState({
      updates: {
        ...currentState.updates,
        status: 'checking',
        error: null,
        lastCheckedAt: new Date().toISOString(),
      },
    })
  })

  autoUpdater.on('update-available', (info) => {
    updateState({
      updates: {
        ...currentState.updates,
        status: 'available',
        availableVersion: info.version || null,
        downloaded: false,
        progress: null,
        error: null,
      },
    })
  })

  autoUpdater.on('update-not-available', () => {
    updateState({
      updates: {
        ...currentState.updates,
        status: 'not-available',
        availableVersion: null,
        downloaded: false,
        progress: null,
        error: null,
      },
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    updateState({
      updates: {
        ...currentState.updates,
        status: 'downloading',
        progress: Number.isFinite(progress.percent) ? progress.percent : null,
        error: null,
      },
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateState({
      updates: {
        ...currentState.updates,
        status: 'downloaded',
        availableVersion: info.version || currentState.updates.availableVersion,
        progress: 100,
        downloaded: true,
        error: null,
      },
    })
  })

  autoUpdater.on('error', (error) => {
    updateState({
      updates: {
        ...currentState.updates,
        status: 'error',
        error: normalizeUpdaterError(error),
      },
    })
  })
}

function initialUpdateState(): UpdateState {
  return {
    status: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    progress: null,
    downloaded: false,
    lastCheckedAt: null,
    error: null,
  }
}

function assertUpdaterAvailable() {
  if (!app.isPackaged && process.env.HORIZON_TRACKER_ALLOW_DEV_UPDATES !== 'true') {
    throw new Error('A verificacao de atualizacoes fica disponivel no aplicativo instalado.')
  }
}

function normalizeUpdaterError(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel verificar atualizacoes.'
}

function updateState(patch: Partial<MonitorState>) {
  currentState = {
    ...currentState,
    ...patch,
  }

  mainWindow?.webContents.send('horizon-boost:state-changed', currentState)
}
