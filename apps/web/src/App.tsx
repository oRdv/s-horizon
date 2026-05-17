import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ToastViewport } from '@/components/ToastViewport'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { BoosterApplicationPage } from '@/pages/BoosterApplicationPage'
import { BoosterOrdersPage } from '@/pages/BoosterOrdersPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { EmailVerificationPage } from '@/pages/EmailVerificationPage'
import { FinancePage } from '@/pages/FinancePage'
import { OrdersPage } from '@/pages/OrdersPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { PaymentResultPage } from '@/pages/PaymentResultPage'
import { SystemDashboardPage } from '@/pages/SystemDashboardPage'
import { authService } from '@/services/auth'
import { useSessionStore } from '@/store/useSessionStore'

function App() {
  const hydrated = useSessionStore((state) => state.hydrated)
  const user = useSessionStore((state) => state.user)
  const accessToken = useSessionStore((state) => state.accessToken)
  const refreshToken = useSessionStore((state) => state.refreshToken)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

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
    if (!user.email_verified_at) return '/verify-email'
    return '/dashboard'
  }

  return (
    <>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={user ? <Navigate replace to={getHomePath()} /> : <LoginPage />} path="/login" />
        <Route element={user ? <Navigate replace to={getHomePath()} /> : <SignupPage />} path="/signup" />
        <Route
          element={
            <ProtectedRoute requireVerifiedEmail={false}>
              <EmailVerificationPage />
            </ProtectedRoute>
          }
          path="/verify-email"
        />
        <Route
          element={
            <ProtectedRoute>
              <SystemDashboardPage />
            </ProtectedRoute>
          }
          path="/dashboard"
        />
        <Route
          element={
            <ProtectedRoute permissions={['users.view_all']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
          path="/admin/users"
        />
        <Route
          element={
            <ProtectedRoute
              permissions={[
                'finance.control.view',
                'finance.booster_payments.view',
                'finance.withdrawals.request',
                'finance.withdrawals.manage',
              ]}
            >
              <FinancePage />
            </ProtectedRoute>
          }
          path="/finance"
        />
        <Route
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
          path="/profile"
        />
        <Route
          element={<BoosterApplicationPage />}
          path="/booster/apply"
        />
        <Route
          element={
            <ProtectedRoute roles={['customer', 'booster']}>
              <PurchasesPage />
            </ProtectedRoute>
          }
          path="/purchases"
        />
        <Route
          element={
            <ProtectedRoute roles={['customer']}>
              <OrdersPage />
            </ProtectedRoute>
          }
          path="/orders"
        />
        <Route
          element={
            <ProtectedRoute roles={['booster']}>
              <BoosterOrdersPage />
            </ProtectedRoute>
          }
          path="/booster/orders"
        />
        <Route
          element={
            <ProtectedRoute roles={['customer']}>
              <PaymentResultPage kind="success" />
            </ProtectedRoute>
          }
          path="/payment/success"
        />
        <Route
          element={
            <ProtectedRoute roles={['customer']}>
              <PaymentResultPage kind="cancel" />
            </ProtectedRoute>
          }
          path="/payment/cancel"
        />
        <Route
          element={
            <ProtectedRoute roles={['customer']}>
              <PaymentResultPage kind="pending" />
            </ProtectedRoute>
          }
          path="/payment/pending"
        />
        <Route
          element={
            <ProtectedRoute roles={['customer']}>
              <PaymentResultPage kind="processing" />
            </ProtectedRoute>
          }
          path="/payment/processing"
        />
      </Routes>
      <ToastViewport />
    </>
  )
}

export default App
