import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useSessionStore } from '@/store/useSessionStore'
import type { UserRole } from '@/types/auth'
import { canAccessAnyPermission, hasRole } from '@/utils/authz'

interface ProtectedRouteProps {
  children: ReactElement
  permissions?: string[]
  requireVerifiedEmail?: boolean
  roles?: UserRole[]
}

export function ProtectedRoute({ children, permissions, requireVerifiedEmail = true, roles }: ProtectedRouteProps) {
  const location = useLocation()
  const user = useSessionStore((state) => state.user)
  const accessToken = useSessionStore((state) => state.accessToken)
  const refreshToken = useSessionStore((state) => state.refreshToken)

  if (!user || (!accessToken && !refreshToken)) {
    const redirect = `${location.pathname}${location.search}`

    return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />
  }

  if (requireVerifiedEmail && !user.email_verified_at) {
    return <Navigate replace state={{ from: location.pathname }} to="/verify-email" />
  }

  if (roles && !hasRole(user, roles)) {
    return <AccessDenied message="Este link e restrito a boosters ativos da plataforma." />
  }

  if (roles?.includes('booster') && user.role === 'booster' && user.is_active === false) {
    return <AccessDenied message="Sua conta booster esta inativa. Fale com o suporte antes de aceitar pedidos." />
  }

  if (permissions && !canAccessAnyPermission(user, permissions)) {
    return <AccessDenied message="Sua conta nao tem permissao para acessar esta area." />
  }

  return children
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen__mark">
        <span className="panel__eyebrow">Acesso restrito</span>
        <strong>{message}</strong>
        <a className="ghost-button" href="/dashboard">Abrir dashboard</a>
      </div>
    </div>
  )
}
