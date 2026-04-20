import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  helper: string
  icon: LucideIcon
}

export function MetricCard({ label, value, helper, icon: Icon }: MetricCardProps) {
  return (
    <article className="metric-card panel">
      <div className="metric-card__icon">
        <Icon size={18} strokeWidth={1.9} />
      </div>

      <div className="metric-card__content">
        <span className="panel__eyebrow">{label}</span>
        <strong>{value}</strong>
        <p>{helper}</p>
      </div>
    </article>
  )
}
