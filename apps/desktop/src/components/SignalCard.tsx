import type { LucideIcon } from 'lucide-react'

interface SignalCardProps {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  footer?: React.ReactNode
}

export function SignalCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  footer,
}: SignalCardProps) {
  return (
    <article className="desktop-card panel">
      <div className="desktop-card__icon">
        <Icon size={18} strokeWidth={1.9} />
      </div>

      <div className="desktop-card__content">
        <span className="eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      {footer ? <div className="desktop-card__footer">{footer}</div> : null}
    </article>
  )
}
