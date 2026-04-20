import type { CSSProperties } from 'react'

interface SparklineBarsProps {
  values: number[]
}

export function SparklineBars({ values }: SparklineBarsProps) {
  return (
    <div className="sparkline-bars" aria-hidden="true">
      {values.map((value, index) => (
        <span
          className="sparkline-bars__item"
          key={`${value}-${index}`}
          style={{ '--bar-size': `${value}%` } as CSSProperties}
        />
      ))}
    </div>
  )
}
