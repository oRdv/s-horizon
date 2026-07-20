import clsx from 'clsx'
import { Link } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'

interface BrandMarkProps {
  compact?: boolean
  label?: string
}

export function BrandMark({ compact = false, label = 'Horizon Boost' }: BrandMarkProps) {
  return (
    <Link
      aria-label={`Ir para a página principal da ${label}`}
      className={clsx('brand-mark', compact && 'brand-mark--compact')}
      to="/"
    >
      <div className="brand-mark__icon">
        <BrandIcon className="brand-mark__image" size={compact ? 34 : 42} />
      </div>

      <div className="brand-mark__copy">
        <strong>{label}</strong>
      </div>
    </Link>
  )
}
