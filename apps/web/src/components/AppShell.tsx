import type { ReactNode } from 'react'

import { BrandMark } from '@/components/BrandMark'
import { ThemeSwitch } from '@/components/ThemeSwitch'

interface AppShellProps {
  userName: string
  onLogout: () => void
  children: ReactNode
}

export function AppShell({ userName, onLogout, children }: AppShellProps) {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-shell__header">
        <BrandMark compact />

        <div className="dashboard-shell__actions">
          <ThemeSwitch />

          <div className="dashboard-shell__user">
            <span>{userName}</span>
            <button className="ghost-button" onClick={onLogout} type="button">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-shell__content">{children}</main>
    </div>
  )
}
