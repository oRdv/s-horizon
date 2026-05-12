import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle, Clock3, Loader2, XCircle } from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { PaymentTransaction, ServiceOrder } from '@/types/system'

function formatCurrencyFromCents(value?: number | string | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0) / 100)
}

export function PaymentResultPage({ kind }: { kind: 'success' | 'cancel' | 'processing' | 'pending' }) {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const location = useLocation()
  const paymentId = useMemo(() => new URLSearchParams(location.search).get('payment_id'), [location.search])
  const [payment, setPayment] = useState<PaymentTransaction | null>(null)
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(paymentId))
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  useEffect(() => {
    let active = true

    async function loadPayment() {
      if (!paymentId) {
        setIsLoading(false)
        return
      }

      try {
        const nextPayment = await systemService.getPaymentStatus(Number(paymentId))
        if (active) {
          setPayment(nextPayment)
          if (nextPayment.orderId) {
            const nextOrder = await systemService.getOrder(nextPayment.orderId)
            if (active) setOrder(nextOrder)
          }
        }
      } catch (requestError: unknown) {
        if (active) {
          setError(getApiErrorMessage(requestError, 'Não foi possível consultar o pagamento agora.'))
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadPayment()

    const interval = kind === 'processing' || kind === 'pending'
      ? window.setInterval(() => void loadPayment(), 5000)
      : null

    return () => {
      active = false
      if (interval) {
        window.clearInterval(interval)
      }
    }
  }, [kind, paymentId])

  useEffect(() => {
    if (payment?.status === 'PAID' && kind !== 'success') {
      window.location.href = `/payment/success?payment_id=${payment.id}`
    }
  }, [kind, payment])

  async function handleLogout() {
    await authService.logout()
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!payment?.orderId) return

    setIsSavingAccount(true)

    try {
      const nextOrder = await systemService.saveOrderGameAccount(payment.orderId, {
        email: accountEmail,
        password: accountPassword,
      })
      setOrder(nextOrder)
      setAccountPassword('')
      addToast({
        tone: 'success',
        title: 'Dados salvos',
        description: 'As informações da conta foram vinculadas ao pedido.',
      })
    } catch (submitError: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível salvar',
        description: getApiErrorMessage(submitError, 'Confira os dados e tente novamente.'),
      })
    } finally {
      setIsSavingAccount(false)
    }
  }

  const icon =
    payment?.status === 'PAID' ? <CheckCircle size={56} /> : kind === 'cancel' ? <XCircle size={56} /> : <Clock3 size={56} />
  const title =
    payment?.status === 'PAID'
      ? 'Pagamento confirmado'
      : kind === 'cancel'
        ? 'Pagamento cancelado'
        : kind === 'processing'
          ? 'Pagamento em processamento'
          : 'Pagamento pendente'

  const shouldRequestGameAccount = payment?.status === 'PAID' && order && !order.has_game_account

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <section className="payment-result-panel panel">
        {isLoading ? <Loader2 className="spin-icon" size={56} /> : icon}
        <h1>{isLoading ? 'Consultando pagamento' : title}</h1>
        {error ? <p>{error}</p> : null}
        {payment ? (
          <p>
            Pagamento: {payment.status} - Valor: {formatCurrencyFromCents(payment.finalAmount ?? payment.amount)}
          </p>
        ) : null}

        {shouldRequestGameAccount ? (
          <form className="payment-account-form" onSubmit={handleAccountSubmit}>
            <div>
              <span className="panel__eyebrow">Dados da conta</span>
              <h2>Informe o login da conta</h2>
              <p>Esses dados ficam vinculados somente ao pedido pago.</p>
            </div>

            <label>
              <span>Email da conta</span>
              <input
                autoComplete="username"
                onChange={(event) => setAccountEmail(event.target.value)}
                placeholder="email@exemplo.com"
                required
                type="email"
                value={accountEmail}
              />
            </label>

            <label>
              <span>Senha da conta</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setAccountPassword(event.target.value)}
                placeholder="Digite a senha"
                required
                type="password"
                value={accountPassword}
              />
            </label>

            <button className="primary-button primary-button--crimson" disabled={isSavingAccount} type="submit">
              {isSavingAccount ? 'Salvando...' : 'Salvar dados da conta'}
            </button>
          </form>
        ) : payment?.status === 'PAID' && order?.has_game_account ? (
          <div className="payment-account-saved">
            <strong>Dados da conta recebidos</strong>
            <span>Seu pedido já está pronto para ser assumido pelo booster.</span>
          </div>
        ) : null}

        <Link className="primary-button primary-button--crimson" to="/orders">
          Ver meus pedidos
        </Link>
      </section>
    </AppShell>
  )
}
