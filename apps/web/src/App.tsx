import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ToastViewport } from '@/components/ToastViewport'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { authService } from '@/services/auth'
import { useSessionStore } from '@/store/useSessionStore'
import { useThemeStore } from '@/store/useThemeStore'

function App() {
  const hydrated = useSessionStore((state) => state.hydrated)
  const user = useSessionStore((state) => state.user)
  const accessToken = useSessionStore((state) => state.accessToken)
  const refreshToken = useSessionStore((state) => state.refreshToken)
  const theme = useThemeStore((state) => state.theme)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    let active = true

    async function bootstrapSession() {
      if (!accessToken && !refreshToken) {
        if (active) {
          setIsBootstrapping(false)
        }

        return
      }

      try {
        await authService.fetchMe()
      } catch {
        useSessionStore.getState().clearSession()
      } finally {
        if (active) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrapSession()

    return () => {
      active = false
    }
  }, [accessToken, hydrated, refreshToken])

  if (!hydrated || isBootstrapping) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__mark">
          <span className="panel__eyebrow">Horizon Boost</span>
          <strong>Sincronizando sessão...</strong>
        </div>
      </div>
    )
  }

  const getHomePath = () => {
    if (!user) return '/'
    return user.role === 'admin' ? '/dashboard' : '/purchases'
  }

  return (
    <>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={user ? <Navigate replace to={getHomePath()} /> : <LoginPage />} path="/login" />
        <Route element={user ? <Navigate replace to={getHomePath()} /> : <SignupPage />} path="/signup" />
        <Route
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
          path="/dashboard"
        />
        <Route
          element={
            <ProtectedRoute>
              <PurchasesPage />
            </ProtectedRoute>
          }
          path="/purchases"
        />
        <Route element={<Navigate replace to={getHomePath()} />} path="*" />
      </Routes>
      <ToastViewport />
    </>
  )
}

export default App
