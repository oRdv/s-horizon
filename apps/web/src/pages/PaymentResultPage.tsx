import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle, Clock3, Loader2, XCircle } from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import type { PaymentTransaction } from '@/types/system'

function formatCurrencyFromCents(value?: number | string | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0) / 100)
}

export function PaymentResultPage({ kind }: { kind: 'success' | 'cancel' | 'processing' | 'pending' }) {
  const user = useSessionStore((state) => state.user)
  const location = useLocation()
  const paymentId = useMemo(() => new URLSearchParams(location.search).get('payment_id'), [location.search])
  const [payment, setPayment] = useState<PaymentTransaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(paymentId))

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
        }
      } catch (requestError: unknown) {
        if (active) {
          setError(getApiErrorMessage(requestError, 'Nao foi possivel consultar o status real do pagamento.'))
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

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <section className="empty-state panel">
        {isLoading ? <Loader2 className="spin-icon" size={56} /> : icon}
        <h1>{isLoading ? 'Consultando pagamento' : title}</h1>
        {error ? <p>{error}</p> : null}
        {payment ? (
          <p>
            Status real: {payment.status} · Valor: {formatCurrencyFromCents(payment.finalAmount ?? payment.amount)}
          </p>
        ) : null}
        <Link className="primary-button primary-button--crimson" to="/purchases">
          Voltar para pedidos
        </Link>
      </section>
    </AppShell>
  )
}
