import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { AuthResponse, AuthUser } from '@/types/auth'

interface SessionState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  hydrated: boolean
  markHydrated: () => void
  setSession: (payload: AuthResponse) => void
  setUser: (user: AuthUser) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),
      setSession: (payload) =>
        set({
          user: payload.data.user ?? null,
          accessToken: payload.access_token ?? null,
          refreshToken: payload.refresh_token ?? null,
        }),
      setUser: (user) => set({ user }),
      clearSession: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      name: 'horizon-boost-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    },
  ),
)
