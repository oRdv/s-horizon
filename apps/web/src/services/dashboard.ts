import type {
  BoosterStatus,
  DashboardOverview,
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
    const displayName = userName?.split(' ')[0] ?? 'usuario'

    return {
      headline: `Controle a operacao do ${displayName} com uma visao clara do mes.`,
      status: preferences.status,
      monthlyGoal: preferences.monthlyGoal,
      monthEarnings: {
        total: 0,
        delta: 0,
        series: [],
        note: 'Sem historico real registrado ainda.',
      },
      upcomingServices: [],
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
