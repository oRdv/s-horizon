import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'

import { useSessionStore } from '@/store/useSessionStore'

interface ProtectedRouteProps {
  children: ReactElement
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = useSessionStore((state) => state.user)

  if (!user) {
    return <Navigate replace to="/" />
  }

  return children
}
