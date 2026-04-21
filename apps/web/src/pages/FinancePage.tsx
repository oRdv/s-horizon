import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Banknote, CreditCard, ReceiptText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import type { PaymentTransaction, WithdrawalRequest } from '@/types/system'
import { hasPermission } from '@/utils/authz'

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value))
}

function formatProvider(provider: PaymentTransaction['provider']) {
  if (provider === 'mercado_pago') {
    return 'Mercado Pago'
  }

  return provider === 'stripe' ? 'Stripe' : 'Manual'
}

function formatMethod(method: PaymentTransaction['method']) {
  return method === 'pix' ? 'Pix' : 'Cartão'
}

export function FinancePage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const canRequestWithdrawal = user?.role === 'booster' && hasPermission(user, 'finance.withdrawals.request')
  const canManageWithdrawals = hasPermission(user, 'finance.withdrawals.manage')
  const canSeeWithdrawals = canRequestWithdrawal || canManageWithdrawals

  const totalPaymentVolume = payments.reduce((total, payment) => total + Number(payment.amount), 0)

  async function loadFinance() {
    const [nextPayments, nextWithdrawals] = await Promise.all([
      systemService.getPayments(),
      canSeeWithdrawals ? systemService.getWithdrawals() : Promise.resolve([]),
    ])

    setPayments(nextPayments)
    setWithdrawals(nextWithdrawals)
  }

  useEffect(() => {
    let active = true

    async function bootstrapFinance() {
      const [nextPayments, nextWithdrawals] = await Promise.all([
        systemService.getPayments(),
        canSeeWithdrawals ? systemService.getWithdrawals() : Promise.resolve([]),
      ])

      if (!active) {
        return
      }

      setPayments(nextPayments)
      setWithdrawals(nextWithdrawals)
    }

    void bootstrapFinance()

    return () => {
      active = false
    }
  }, [canSeeWithdrawals])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function handleWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(withdrawalAmount)

    if (!amount || amount <= 0) {
      return
    }

    await systemService.requestWithdrawal({ amount, method: 'pix' })
    setWithdrawalAmount('')
    await loadFinance()
  }

  async function handleReview(id: number, status: 'approved' | 'rejected' | 'paid') {
    await systemService.reviewWithdrawal(id, status)
    await loadFinance()
  }

  return (
    <AppShell onLogout={handleLogout} userName={user?.name ?? 'Usuário'}>
      <div className="finance-page">
        <section className="system-hero panel">
          <div>
            <span className="panel__eyebrow">Financeiro</span>
            <h1>Pagamentos, compras e retiradas</h1>
          </div>
        </section>

        <section className="system-card-grid system-card-grid--three">
          <article className="summary-card panel">
            <CreditCard size={20} />
            <span>Volume registrado</span>
            <strong>{formatCurrency(totalPaymentVolume)}</strong>
          </article>
          <article className="summary-card panel">
            <ReceiptText size={20} />
            <span>Transações</span>
            <strong>{payments.length}</strong>
          </article>
          <article className="summary-card panel">
            <Banknote size={20} />
            <span>Saques</span>
            <strong>{withdrawals.length}</strong>
          </article>
        </section>

        <section className="system-grid-two">
          <article className="management-panel panel payment-preview-panel">
            <CreditCard size={22} />
            <h2>Transações</h2>
            <div className="payment-preview-list">
              {payments.length ? (
                payments.map((payment) => (
                  <div className="payment-preview-item" key={payment.id}>
                    <div>
                      <strong>{payment.service_order?.title ?? 'Pagamento Horizon'}</strong>
                      <span>
                        {formatProvider(payment.provider)} · {formatMethod(payment.method)} · {payment.status}
                      </span>
                    </div>
                    <div>
                      <strong>{formatCurrency(payment.amount)}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <p>Nenhuma transação registrada ainda.</p>
              )}
            </div>
          </article>

          {canSeeWithdrawals ? (
            <article className="management-panel panel">
              <Banknote size={22} />
              <h2>Solicitações de saque</h2>
              {canRequestWithdrawal ? (
                <form className="inline-form" onSubmit={handleWithdrawal}>
                  <input
                    placeholder="Valor para sacar"
                    type="number"
                    value={withdrawalAmount}
                    onChange={(event) => setWithdrawalAmount(event.target.value)}
                  />
                  <button className="primary-button" type="submit">
                    Solicitar
                  </button>
                </form>
              ) : null}
              <div className="stack-list">
                {withdrawals.length ? (
                  withdrawals.map((withdrawal) => (
                    <div className="stack-list__item" key={withdrawal.id}>
                      <strong>{formatCurrency(withdrawal.amount)}</strong>
                      <span>{withdrawal.booster?.name ?? 'Meu saque'} · {withdrawal.status}</span>
                      {canManageWithdrawals ? (
                        <div className="row-actions">
                          <button className="ghost-button" onClick={() => void handleReview(withdrawal.id, 'approved')} type="button">
                            Aprovar
                          </button>
                          <button className="ghost-button" onClick={() => void handleReview(withdrawal.id, 'rejected')} type="button">
                            Rejeitar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p>Nenhuma solicitação de saque registrada ainda.</p>
                )}
              </div>
            </article>
          ) : null}
        </section>
      </div>
    </AppShell>
  )
}
