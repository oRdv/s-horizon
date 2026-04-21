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
    return <Navigate replace to="/login" />
  }

  if (requireVerifiedEmail && !user.email_verified_at) {
    return <Navigate replace state={{ from: location.pathname }} to="/verify-email" />
  }

  if (roles && !hasRole(user, roles)) {
    return <Navigate replace to="/dashboard" />
  }

  if (permissions && !canAccessAnyPermission(user, permissions)) {
    return <Navigate replace to="/dashboard" />
  }

  return children
}
