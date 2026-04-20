import { contextBridge, ipcRenderer } from 'electron'

import type { DesktopSession, MonitorState } from '../shared/types.js'

const api = {
  bootstrap: () => ipcRenderer.invoke('horizon-boost:bootstrap') as Promise<MonitorState>,
  saveSession: (session: DesktopSession) =>
    ipcRenderer.invoke('horizon-boost:save-session', session) as Promise<MonitorState>,
  clearSession: () => ipcRenderer.invoke('horizon-boost:clear-session') as Promise<MonitorState>,
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
