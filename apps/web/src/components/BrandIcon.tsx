interface BrandIconProps {
  size?: number
  className?: string
}

export function BrandIcon({ size = 40, className }: BrandIconProps) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      height={size}
      src="/horizon-poro.png"
      width={size}
    />
  )
}
