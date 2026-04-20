import clsx from 'clsx'

import type { BoosterStatus } from '@/types/dashboard'

interface StatusSwitchProps {
  status: BoosterStatus
  onChange: (status: BoosterStatus) => void
}

const statusLabels: Record<BoosterStatus, string> = {
  online: 'Online',
  in_match: 'Em partida',
}

export function StatusSwitch({ status, onChange }: StatusSwitchProps) {
  const options: BoosterStatus[] = ['online', 'in_match']

  return (
    <div className="status-switch">
      {options.map((option) => (
        <button
          key={option}
          className={clsx('status-switch__button', status === option && 'is-active')}
          onClick={() => onChange(option)}
          type="button"
        >
          {statusLabels[option]}
        </button>
      ))}
    </div>
  )
}
