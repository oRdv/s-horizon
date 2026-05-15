import electronRenderer from 'electron/renderer'

import type {
  DesktopOrder,
  HeartbeatPayload,
  LcuSnapshot,
  LoginPayload,
  MonitorState,
} from '../shared/types.js'

const { contextBridge, ipcRenderer } = electronRenderer
const api = {
  bootstrap: () => ipcRenderer.invoke('horizon-boost:bootstrap') as Promise<MonitorState>,
  login: (payload: LoginPayload) => ipcRenderer.invoke('horizon-boost:login', payload) as Promise<MonitorState>,
  logout: () => ipcRenderer.invoke('horizon-boost:logout') as Promise<MonitorState>,
  getOrders: () => ipcRenderer.invoke('horizon-boost:get-orders') as Promise<DesktopOrder[]>,
  lcuSnapshot: () => ipcRenderer.invoke('horizon-boost:lcu-snapshot') as Promise<LcuSnapshot>,
  heartbeat: (payload: HeartbeatPayload) =>
    ipcRenderer.invoke('horizon-boost:heartbeat', payload) as Promise<MonitorState>,
  matchFinished: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('horizon-boost:match-finished', payload) as Promise<MonitorState>,
  onStateChange: (callback: (state: MonitorState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MonitorState) => {
      callback(state)
    }

    ipcRenderer.on('horizon-boost:state-changed', listener)

    return () => {
      ipcRenderer.removeListener('horizon-boost:state-changed', listener)
    }
  },
}

contextBridge.exposeInMainWorld('horizonBoostDesktop', api)
