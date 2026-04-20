import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { ThemeVariant } from '@/types/dashboard'

interface ThemeState {
  theme: ThemeVariant
  setTheme: (theme: ThemeVariant) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'crimson',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({
          theme: get().theme === 'mono' ? 'crimson' : 'mono',
        }),
    }),
    {
      name: 'horizon-boost-theme',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
