import type {
  DesktopOrder,
  HeartbeatPayload,
  LcuSnapshot,
  LoginPayload,
  MonitorState,
} from '../shared/types'

declare global {
  interface Window {
    horizonBoostDesktop?: {
      bootstrap: () => Promise<MonitorState>
      login: (payload: LoginPayload) => Promise<MonitorState>
      logout: () => Promise<MonitorState>
      getOrders: () => Promise<DesktopOrder[]>
      lcuSnapshot: () => Promise<LcuSnapshot>
      heartbeat: (payload: HeartbeatPayload) => Promise<MonitorState>
      matchFinished: (payload: Record<string, unknown>) => Promise<MonitorState>
      checkForUpdates: () => Promise<MonitorState['updates']>
      downloadUpdate: () => Promise<MonitorState['updates']>
      installUpdate: () => Promise<MonitorState['updates']>
      onStateChange: (callback: (state: MonitorState) => void) => () => void
    }
  }
}

export {}
