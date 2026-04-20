import type { DesktopSession, MonitorState } from '../shared/types'

declare global {
  interface Window {
    horizonBoostDesktop?: {
      bootstrap: () => Promise<MonitorState>
      saveSession: (session: DesktopSession) => Promise<MonitorState>
      clearSession: () => Promise<MonitorState>
      onStateChange: (callback: (state: MonitorState) => void) => () => void
    }
  }
}

export {}
