type IconSize = '16' | '24' | '32'
type IconColor = 'white' | 'dark' | 'green'

interface IconProps {
  size: IconSize
  color: IconColor
  className?: string
}

export function Icon({ size, color, className = '' }: IconProps) {
  return (
    <img
      src={`/brand/icons/icon-c-${size}-${color}.svg`}
      alt=""
      width={parseInt(size)}
      height={parseInt(size)}
      className={className}
      aria-hidden="true"
    />
  )
}
