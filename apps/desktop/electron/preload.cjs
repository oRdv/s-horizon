const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('horizonBoostDesktop', {
  bootstrap: () => ipcRenderer.invoke('horizon-boost:bootstrap'),
  login: (payload) => ipcRenderer.invoke('horizon-boost:login', payload),
  logout: () => ipcRenderer.invoke('horizon-boost:logout'),
  getOrders: () => ipcRenderer.invoke('horizon-boost:get-orders'),
  lcuSnapshot: () => ipcRenderer.invoke('horizon-boost:lcu-snapshot'),
  heartbeat: (payload) => ipcRenderer.invoke('horizon-boost:heartbeat', payload),
  matchFinished: (payload) => ipcRenderer.invoke('horizon-boost:match-finished', payload),
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state)

    ipcRenderer.on('horizon-boost:state-changed', listener)

    return () => {
      ipcRenderer.removeListener('horizon-boost:state-changed', listener)
    }
  },
})
