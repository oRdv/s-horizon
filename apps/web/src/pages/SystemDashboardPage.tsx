import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  BadgeDollarSign,
  Banknote,
  ClipboardList,
  ShieldCheck,
  ShoppingBag,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { authService } from '@/services/auth'
import { systemService, type RoleDashboard } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import type {
  BoosterDashboard,
  CustomerDashboard,
  MasterDashboard,
  PaymentTransaction,
  StaffDashboard,
} from '@/types/system'
import { getRoleDashboardLabel, hasPermission } from '@/utils/authz'

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatPaymentMethod(method: PaymentTransaction['method']) {
  return method === 'pix' ? 'Pix' : 'Cartão'
}

function formatPaymentProvider(provider: PaymentTransaction['provider']) {
  if (provider === 'mercado_pago') {
    return 'Mercado Pago'
  }

  return provider === 'stripe' ? 'Stripe' : 'Manual'
}

export function SystemDashboardPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)
  const [dashboard, setDashboard] = useState<RoleDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      if (!user) {
        return
      }

      setIsLoading(true)

      try {
        const payload = await systemService.getDashboard(user.role)

        if (!active) {
          return
        }

        setDashboard(payload)
        setIsLoading(false)
      } catch (error) {
        if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
          clearSession()
          navigate('/login', { replace: true })
          return
        }

        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [clearSession, navigate, user])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  if (!user || isLoading || !dashboard) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__mark">
          <span className="panel__eyebrow">Horizon Boost</span>
          <strong>Carregando dashboard...</strong>
        </div>
      </div>
    )
  }

  return (
    <AppShell onLogout={handleLogout} userName={user.name}>
      <div className="system-dashboard">
        <section className="system-hero panel">
          <div>
            <span className="panel__eyebrow">{getRoleDashboardLabel(user.role)}</span>
            <h1>Central Horizon Boost</h1>
          </div>

          <div className="system-hero__actions">
            {hasPermission(user, 'users.view_all') ? (
              <Link className="primary-button" to="/admin/users">
                Gerenciar usuários
              </Link>
            ) : null}
            <Link className="ghost-button" to="/profile">
              Segurança da conta
            </Link>
          </div>
        </section>

        {user.role === 'master_admin' ? <MasterDashboardView dashboard={dashboard as MasterDashboard} /> : null}
        {user.role === 'staff' ? <StaffDashboardView dashboard={dashboard as StaffDashboard} /> : null}
        {user.role === 'booster' ? <BoosterDashboardView dashboard={dashboard as BoosterDashboard} /> : null}
        {user.role === 'customer' ? <CustomerDashboardView dashboard={dashboard as CustomerDashboard} /> : null}
      </div>
    </AppShell>
  )
}

function MasterDashboardView({ dashboard }: { dashboard: MasterDashboard }) {
  return (
    <>
      <section className="system-card-grid">
        <SummaryCard icon={Users} label="Clientes" value={dashboard.summary.total_clients} />
        <SummaryCard icon={ShieldCheck} label="Boosters" value={dashboard.summary.total_boosters} />
        <SummaryCard icon={ClipboardList} label="Staffs" value={dashboard.summary.total_staffs} />
        <SummaryCard icon={ShoppingBag} label="Pedidos" value={dashboard.summary.total_orders} />
        <SummaryCard icon={Banknote} label="Pagamentos pendentes" value={dashboard.summary.pending_payments} />
        <SummaryCard icon={BadgeDollarSign} label="Total faturado" value={formatCurrency(dashboard.summary.total_revenue)} />
      </section>

      <section className="system-grid-two">
        <article className="management-panel panel">
          <span className="panel__eyebrow">Metas globais</span>
          <h2>Operação do mês</h2>
          <div className="metric-list">
            {Object.entries(dashboard.global_goals).length ? (
              Object.entries(dashboard.global_goals).map(([key, value]) => (
                <div key={key}>
                  <span>{key.replaceAll('_', ' ')}</span>
                  <strong>{value}</strong>
                </div>
              ))
            ) : (
              <p>Nenhuma meta global cadastrada ainda.</p>
            )}
          </div>
        </article>

        <article className="management-panel panel">
          <span className="panel__eyebrow">Solicitações de pagamento</span>
          <h2>Retiradas pendentes</h2>
          <div className="stack-list">
            {dashboard.pending_withdrawal_requests.length ? (
              dashboard.pending_withdrawal_requests.map((withdrawal) => (
                <div className="stack-list__item" key={withdrawal.id}>
                  <strong>{withdrawal.booster?.name ?? 'Booster'}</strong>
                  <span>{formatCurrency(withdrawal.amount)} aguardando revisão</span>
                </div>
              ))
            ) : (
              <p>Nenhuma retirada pendente agora.</p>
            )}
          </div>
        </article>
      </section>
    </>
  )
}

function StaffDashboardView({ dashboard }: { dashboard: StaffDashboard }) {
  return (
    <>
      <section className="system-card-grid">
        <SummaryCard icon={ClipboardList} label="Pedidos ativos" value={dashboard.operation.active_orders} />
        <SummaryCard icon={Users} label="Boosters ativos" value={dashboard.operation.active_boosters} />
        <SummaryCard icon={Banknote} label="Retiradas pendentes" value={dashboard.finance.pending_withdrawals} />
        <SummaryCard icon={BadgeDollarSign} label="Receita do mês" value={formatCurrency(dashboard.finance.month_revenue)} />
      </section>

      <article className="management-panel panel">
        <span className="panel__eyebrow">Operação</span>
        <h2>Pedidos recentes</h2>
        <div className="stack-list">
          {dashboard.operation.recent_orders.length ? (
            dashboard.operation.recent_orders.map((order) => (
              <div className="stack-list__item" key={order.id}>
                <strong>{order.title}</strong>
                <span>{order.status} · {order.customer?.name ?? 'Cliente sem nome'}</span>
              </div>
            ))
          ) : (
            <p>Nenhum pedido recente registrado.</p>
          )}
        </div>
      </article>
    </>
  )
}

function BoosterDashboardView({ dashboard }: { dashboard: BoosterDashboard }) {
  return (
    <>
      <section className="system-card-grid">
        <SummaryCard icon={ClipboardList} label="Pedidos ativos" value={dashboard.progress.active_orders} />
        <SummaryCard icon={Target} label="Pedidos concluídos" value={dashboard.progress.completed_orders} />
        <SummaryCard icon={BadgeDollarSign} label="Disponível" value={formatCurrency(dashboard.earnings.available)} />
        <SummaryCard icon={Banknote} label="Saques pendentes" value={formatCurrency(dashboard.earnings.pending_withdrawals)} />
      </section>

      <article className="management-panel panel">
        <span className="panel__eyebrow">Meus serviços</span>
        <h2>Pedidos atribuídos</h2>
        <div className="stack-list">
          {dashboard.assigned_orders.length ? (
            dashboard.assigned_orders.map((order) => (
              <div className="stack-list__item" key={order.id}>
                <strong>{order.title}</strong>
                <span>{order.status} · {formatCurrency(order.price)}</span>
              </div>
            ))
          ) : (
            <p>Nenhum pedido atribuído ainda.</p>
          )}
        </div>
      </article>
    </>
  )
}

function CustomerDashboardView({ dashboard }: { dashboard: CustomerDashboard }) {
  return (
    <>
      <section className="system-card-grid system-card-grid--three">
        <SummaryCard icon={ShoppingBag} label="Pedidos comprados" value={dashboard.history.total_orders} />
        <SummaryCard icon={Target} label="Concluídos" value={dashboard.history.completed_orders} />
        <SummaryCard icon={Banknote} label="Pagamentos" value={dashboard.payments.length} />
      </section>

      <section className="system-grid-two">
        <article className="management-panel panel">
          <span className="panel__eyebrow">Área do cliente</span>
          <h2>Pedidos e andamento</h2>
          <div className="stack-list">
            {dashboard.orders.length ? (
              dashboard.orders.map((order) => (
                <div className="stack-list__item" key={order.id}>
                  <strong>{order.title}</strong>
                  <span>{order.status} · {formatCurrency(order.price)}</span>
                </div>
              ))
            ) : (
              <>
                <p>Você ainda não tem pedidos. A tabela de preços completa fica na área de compras.</p>
                <Link className="primary-button" to="/purchases">
                  Abrir tabela completa
                </Link>
              </>
            )}
          </div>
        </article>

        <article className="management-panel panel payment-preview-panel">
          <span className="panel__eyebrow">Pagamentos</span>
          <h2>Histórico recente</h2>
          <div className="payment-preview-list">
            {dashboard.payments.length ? (
              dashboard.payments.map((payment) => (
                <div className="payment-preview-item" key={payment.id}>
                  <div>
                    <strong>{payment.service_order?.title ?? 'Pagamento Horizon'}</strong>
                    <span>
                      {formatPaymentProvider(payment.provider)} · {formatPaymentMethod(payment.method)} · {payment.status}
                    </span>
                  </div>
                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                  </div>
                </div>
              ))
            ) : (
              <p>Nenhum pagamento registrado ainda.</p>
            )}
          </div>
        </article>
      </section>
    </>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number | string
}) {
  return (
    <article className="summary-card panel">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
