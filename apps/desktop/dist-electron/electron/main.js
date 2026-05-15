import electronMain from 'electron/main';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackendReporter } from './services/backendReporter.js';
import { LcuMonitor } from './services/lcuMonitor.js';
import { SessionStore } from './services/sessionStore.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { app, BrowserWindow, ipcMain } = electronMain;
let mainWindow = null;
const sessionStore = new SessionStore();
const lcuMonitor = new LcuMonitor();
let currentState = {
    session: null,
    isAuthenticated: false,
    leagueClient: 'disconnected',
    activeOrderId: null,
    latestSnapshot: null,
    lastHeartbeatAt: null,
    lastError: null,
};
const reporter = new BackendReporter(async (session) => {
    await sessionStore.save(session);
    updateState({
        session: session ? { apiBaseUrl: session.apiBaseUrl, user: session.user } : null,
        isAuthenticated: Boolean(session?.accessToken),
    });
});
app.whenReady().then(async () => {
    const storedSession = await sessionStore.load();
    reporter.setSession(storedSession);
    updateState({
        session: storedSession ? { apiBaseUrl: storedSession.apiBaseUrl, user: storedSession.user } : null,
        isAuthenticated: Boolean(storedSession?.accessToken),
    });
    registerIpcHandlers();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
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
    });
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        void mainWindow.loadURL(devServerUrl);
    }
    else {
        void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}
function registerIpcHandlers() {
    ipcMain.handle('horizon-boost:bootstrap', async () => currentState);
    ipcMain.handle('horizon-boost:login', async (_event, payload) => {
        const session = await reporter.login(payload);
        updateState({
            session: { apiBaseUrl: session.apiBaseUrl, user: session.user },
            isAuthenticated: true,
            lastError: null,
        });
        return currentState;
    });
    ipcMain.handle('horizon-boost:logout', async () => {
        await reporter.clear();
        updateState({
            session: null,
            isAuthenticated: false,
            activeOrderId: null,
            lastError: null,
        });
        return currentState;
    });
    ipcMain.handle('horizon-boost:get-orders', async () => reporter.getOrders());
    ipcMain.handle('horizon-boost:lcu-snapshot', async () => {
        const snapshot = await lcuMonitor.snapshot();
        updateState({
            latestSnapshot: snapshot,
            leagueClient: snapshot.clientOpen ? 'connected' : 'disconnected',
            lastError: snapshot.error,
        });
        return snapshot;
    });
    ipcMain.handle('horizon-boost:heartbeat', async (_event, payload) => {
        await reporter.sendHeartbeat(payload);
        updateState({
            activeOrderId: payload.orderId,
            lastHeartbeatAt: new Date().toISOString(),
            lastError: null,
        });
        return currentState;
    });
    ipcMain.handle('horizon-boost:match-finished', async (_event, payload) => {
        await reporter.sendMatchFinished(payload);
        return currentState;
    });
}
function updateState(patch) {
    currentState = {
        ...currentState,
        ...patch,
    };
    mainWindow?.webContents.send('horizon-boost:state-changed', currentState);
}
//# sourceMappingURL=main.js.map