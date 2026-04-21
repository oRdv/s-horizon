import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'
import { useSessionStore } from '@/store/useSessionStore'
import { canAccessAnyPermission, hasPermission } from '@/utils/authz'

interface AppShellProps {
  userName: string
  onLogout: () => void
  children: ReactNode
}

export function AppShell({ userName, onLogout, children }: AppShellProps) {
  const user = useSessionStore((state) => state.user)
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const roleLabel = user?.role_label ?? user?.role ?? 'Conta'
  const canSeeFinance = canAccessAnyPermission(user, [
    'finance.control.view',
    'finance.booster_payments.view',
    'finance.withdrawals.request',
    'finance.withdrawals.manage',
  ])

  return (
    <div className="dashboard-shell">
      <header className="dashboard-shell__header">
        <BrandMark compact />

        <nav className="dashboard-shell__nav" aria-label="Navegação do painel">
          <NavLink to="/dashboard" className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}>
            Dashboard
          </NavLink>
          {hasPermission(user, 'users.view_all') ? (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}
            >
              Usuários
            </NavLink>
          ) : null}
          {hasPermission(user, 'tournaments.view_all') ? (
            <NavLink
              to="/admin/tournaments"
              className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}
            >
              Campeonatos
            </NavLink>
          ) : null}
          {user?.role === 'customer' ? (
            <NavLink
              to="/purchases"
              className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}
            >
              Preços e pedidos
            </NavLink>
          ) : null}
          {user?.role === 'customer' ? (
            <NavLink
              to="/tournaments"
              className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}
            >
              Campeonatos
            </NavLink>
          ) : null}
          {canSeeFinance ? (
            <NavLink to="/finance" className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}>
              Financeiro
            </NavLink>
          ) : null}
          <NavLink to="/profile" className={({ isActive }) => `dashboard-shell__nav-link${isActive ? ' is-active' : ''}`}>
            Perfil
          </NavLink>
          <a
            className="dashboard-shell__nav-link dashboard-shell__nav-link--external"
            href="https://discord.gg/cHPCH7BsrM"
            rel="noreferrer"
            target="_blank"
          >
            Discord
          </a>
        </nav>

        <div className="dashboard-shell__account">
          <div className="dashboard-shell__avatar" aria-hidden="true">
            {initials || 'HB'}
          </div>
          <div className="dashboard-shell__account-copy">
            <span>{userName}</span>
            <small>{roleLabel}</small>
          </div>
          <button aria-label="Sair" className="dashboard-shell__logout" onClick={onLogout} type="button">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="dashboard-shell__content">{children}</main>
    </div>
  )
}
