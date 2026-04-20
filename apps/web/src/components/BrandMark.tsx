import clsx from 'clsx'
import { Link } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'

interface BrandMarkProps {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Link
      aria-label="Ir para a landing page da Horizon Boost"
      className={clsx('brand-mark', compact && 'brand-mark--compact')}
      to="/"
    >
      <div className="brand-mark__icon">
        <BrandIcon className="brand-mark__image" size={compact ? 34 : 42} />
      </div>

      <div className="brand-mark__copy">
        <strong>Horizon Boost</strong>
      </div>
    </Link>
  )
}
