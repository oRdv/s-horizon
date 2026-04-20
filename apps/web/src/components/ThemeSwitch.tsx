import clsx from 'clsx'

import { useThemeStore } from '@/store/useThemeStore'

export function ThemeSwitch() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  return (
    <button
      aria-label="Alternar tema"
      className={clsx('theme-toggle', theme === 'crimson' && 'is-crimson')}
      onClick={toggleTheme}
      type="button"
    >
      <div className="theme-toggle__track">
        <div className="theme-toggle__ball" />
      </div>
    </button>
  )
}
