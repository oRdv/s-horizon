import { contextBridge, ipcRenderer } from 'electron';
const api = {
    bootstrap: () => ipcRenderer.invoke('horizon-boost:bootstrap'),
    saveSession: (session) => ipcRenderer.invoke('horizon-boost:save-session', session),
    clearSession: () => ipcRenderer.invoke('horizon-boost:clear-session'),
    onStateChange: (callback) => {
        const listener = (_event, state) => {
            callback(state);
        };
        ipcRenderer.on('horizon-boost:state-changed', listener);
        return () => {
            ipcRenderer.removeListener('horizon-boost:state-changed', listener);
        };
    },
};
contextBridge.exposeInMainWorld('horizonBoostDesktop', api);
//# sourceMappingURL=preload.js.map