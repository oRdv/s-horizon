import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  CircleDollarSign,
  Flag,
  Radar,
  RefreshCcw,
  Rocket,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { MetricCard } from '@/components/MetricCard'
import { ServicesPanel } from '@/components/ServicesPanel'
import { SparklineBars } from '@/components/SparklineBars'
import { StatusSwitch } from '@/components/StatusSwitch'
import { WidgetFrame } from '@/components/WidgetFrame'
import { authService } from '@/services/auth'
import { dashboardService } from '@/services/dashboard'
import { useSessionStore } from '@/store/useSessionStore'
import type { BoosterStatus, DashboardOverview } from '@/types/dashboard'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [isSavingGoal, setIsSavingGoal] = useState(false)

  useEffect(() => {
    let active = true

    async function loadOverview() {
      const snapshot = await dashboardService.getOverview(user?.name)

      if (!active) {
        return
      }

      setOverview(snapshot)
      setGoalInput(String(snapshot.monthlyGoal))
    }

    loadOverview()

    return () => {
      active = false
    }
  }, [user?.name])

  const progress = useMemo(() => {
    if (!overview) {
      return 0
    }

    return Math.min(
      100,
      Math.round((overview.monthEarnings.total / overview.monthlyGoal) * 100),
    )
  }, [overview])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function handleGoalSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextGoal = Number(goalInput)

    if (!overview || Number.isNaN(nextGoal) || nextGoal <= 0) {
      return
    }

    setIsSavingGoal(true)

    const savedGoal = await dashboardService.updateMonthlyGoal(nextGoal)

    setOverview({
      ...overview,
      monthlyGoal: savedGoal,
    })

    setIsSavingGoal(false)
  }

  async function handleStatusChange(status: BoosterStatus) {
    if (!overview) {
      return
    }

    const nextStatus = await dashboardService.updateStatus(status)

    setOverview({
      ...overview,
      status: nextStatus,
    })
  }

  if (!user || !overview) {
    return (
      <div className="loading-screen">
        <BrandFallback />
      </div>
    )
  }

  return (
    <AppShell onLogout={handleLogout} userName={user.name}>
      <section className="hero-band panel fade-in">
        <div className="hero-band__copy">
          <span className="panel__eyebrow">Visão geral</span>
          <h1>{overview.headline}</h1>
          <p>
            Acompanhe ganhos, serviços e disponibilidade em um único lugar. Quanto
            melhor a operação, mais fácil vender recorrência e entregar uma experiência
            premium para quem compra boost.
          </p>
        </div>

        <div className="hero-band__stats">
          <div className="hero-band__stat">
            <span>Progresso da meta</span>
            <strong>{progress}%</strong>
          </div>

          <div className="hero-band__stat">
            <span>Status atual</span>
            <strong>{overview.status === 'online' ? 'Online' : 'Em partida'}</strong>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          helper="Use esse numero para entender capacidade, precificar melhor e vender pacotes maiores."
          icon={CircleDollarSign}
          label="Ganhos do mês"
          value={formatCurrency(overview.monthEarnings.total)}
        />
        <MetricCard
          helper="Uma meta clara ajuda a empurrar ofertas, combos e janelas premium."
          icon={Flag}
          label="Meta mensal"
          value={formatCurrency(overview.monthlyGoal)}
        />
        <MetricCard
          helper="Status atualizado aumenta confianca para clientes que querem comprar agora."
          icon={Radar}
          label="Status"
          value={overview.status === 'online' ? 'Online' : 'Em partida'}
        />
      </section>

      <section className="sales-grid">
        <article className="sales-card panel">
          <Rocket size={20} />
          <div>
            <span className="panel__eyebrow">Oferta em destaque</span>
            <h3>Venda combos de 3 a 5 partidas para reduzir intervalo morto.</h3>
            <p>
              Clientes que já compraram tendem a aceitar upgrades quando veem prazo,
              segurança e acompanhamento no painel.
            </p>
          </div>
        </article>

        <article className="sales-card panel">
          <Users size={20} />
          <div>
            <span className="panel__eyebrow">Retenção</span>
            <h3>Transforme compradores avulsos em recorrentes.</h3>
            <p>
              Use histórico, status e próximos serviços para oferecer nova fila ou
              pacote de manutenção assim que o pedido terminar.
            </p>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-grid__primary">
          <WidgetFrame
            subtitle="Lista baseada apenas em servicos reais."
            title="Próximos serviços"
          >
            <ServicesPanel services={overview.upcomingServices} />
          </WidgetFrame>

          <WidgetFrame
            subtitle="Linha visual do mês para leitura rápida de performance."
            title="Ganhos e ritmo"
          >
            <div className="earnings-widget">
              <div className="earnings-widget__summary">
                <div>
                  <strong>{formatCurrency(overview.monthEarnings.total)}</strong>
                  <p>{overview.monthEarnings.note}</p>
                </div>

                <span className="pill pill--positive">
                  <TrendingUp size={14} strokeWidth={2} />
                  +{overview.monthEarnings.delta}% frente ao ritmo alvo
                </span>
              </div>

              <SparklineBars values={overview.monthEarnings.series} />
            </div>
          </WidgetFrame>
        </div>

        <div className="dashboard-grid__secondary">
          <WidgetFrame
            subtitle="Persistido localmente por enquanto para acelerar o setup."
            title="Meta mensal editavel"
          >
            <form className="goal-form" onSubmit={handleGoalSave}>
              <label className="field">
                <span>Nova meta</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setGoalInput(event.target.value)}
                  type="number"
                  value={goalInput}
                />
              </label>

              <button
                className="primary-button"
                disabled={isSavingGoal}
                type="submit"
              >
                {isSavingGoal ? 'Salvando...' : 'Salvar meta'}
              </button>
            </form>

            <div className="progress-ring">
              <div className="progress-ring__value">{progress}%</div>
              <div className="progress-ring__label">meta concluída</div>
            </div>
          </WidgetFrame>

          <WidgetFrame
            subtitle="Pronto para registrar partidas vindas do app desktop e do client."
            title="Status operacional"
          >
            <StatusSwitch onChange={handleStatusChange} status={overview.status} />

            <div className="status-note">
              <RefreshCcw size={16} strokeWidth={1.9} />
              <p>
                O painel já está preparado para refresh automático de token e para
                receber eventos de partida.
              </p>
            </div>
          </WidgetFrame>
        </div>
      </section>
    </AppShell>
  )
}

function BrandFallback() {
  return (
    <div className="loading-screen__mark">
      <span className="panel__eyebrow">Horizon Boost</span>
      <strong>Preparando dashboard...</strong>
    </div>
  )
}
