import type {
  BoosterStatus,
  DashboardOverview,
  ThemeVariant,
} from '@/types/dashboard'

interface DashboardPreferences {
  monthlyGoal: number
  status: BoosterStatus
}

const DASHBOARD_PREFERENCES_KEY = 'horizon-boost-dashboard-preferences'

const defaultPreferences: DashboardPreferences = {
  monthlyGoal: 18000,
  status: 'online',
}

function readPreferences(): DashboardPreferences {
  const rawValue = localStorage.getItem(DASHBOARD_PREFERENCES_KEY)

  if (!rawValue) {
    return defaultPreferences
  }

  try {
    return {
      ...defaultPreferences,
      ...(JSON.parse(rawValue) as Partial<DashboardPreferences>),
    }
  } catch {
    return defaultPreferences
  }
}

function writePreferences(preferences: DashboardPreferences): void {
  localStorage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify(preferences))
}

export const dashboardService = {
  async getOverview(userName?: string): Promise<DashboardOverview> {
    const preferences = readPreferences()
    const displayName = userName?.split(' ')[0] ?? 'Captain'

    return {
      headline: `Controle a operação do ${displayName} com uma visão clara do mês.`,
      status: preferences.status,
      monthlyGoal: preferences.monthlyGoal,
      monthEarnings: {
        total: 12450,
        delta: 18,
        series: [24, 28, 35, 41, 37, 52, 61, 74, 69, 88, 92, 100],
        note: 'Dados simulados para substituir por histórico real depois.',
      },
      upcomingServices: [
        {
          id: 'svc-01',
          customer: 'Astra Duo',
          queue: 'Flex 5v5',
          scheduleLabel: 'Hoje, 21:00',
          notes: 'Sessão longa com bom ticket. Ideal para oferecer pacote de acompanhamento.',
        },
        {
          id: 'svc-02',
          customer: 'Noctis Rush',
          queue: 'SoloQ Master',
          scheduleLabel: 'Amanhã, 18:30',
          notes: 'Janela boa para grind de três partidas e upgrade para combo maior.',
        },
        {
          id: 'svc-03',
          customer: 'Velvet Climb',
          queue: 'Duo Emerald',
          scheduleLabel: 'Sábado, 14:00',
          notes: 'Plano leve para aquecimento, com chance de converter em recorrência.',
        },
      ],
    }
  },

  async updateMonthlyGoal(monthlyGoal: number): Promise<number> {
    const nextPreferences = {
      ...readPreferences(),
      monthlyGoal,
    }

    writePreferences(nextPreferences)

    return nextPreferences.monthlyGoal
  },

  async updateStatus(status: BoosterStatus): Promise<BoosterStatus> {
    const nextPreferences = {
      ...readPreferences(),
      status,
    }

    writePreferences(nextPreferences)

    return nextPreferences.status
  },
}

export const themeLabels: Record<ThemeVariant, string> = {
  mono: 'Black / White',
  crimson: 'Black / Red',
}
