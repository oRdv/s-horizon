import clsx from 'clsx'

interface StatePillProps {
  label: string
  tone?: 'neutral' | 'positive' | 'danger'
}

export function StatePill({ label, tone = 'neutral' }: StatePillProps) {
  return <span className={clsx('state-pill', `state-pill--${tone}`)}>{label}</span>
}
