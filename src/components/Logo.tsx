'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface LogoProps {
  theme?: 'light' | 'dark'
  className?: string
  size?: number
}

export function Logo({ theme, className = 'h-8 w-auto', size }: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const activeTheme = theme ?? (mounted ? resolvedTheme : 'light')

  const src = activeTheme === 'dark'
    ? '/brand/logos/logo-dark.svg'
    : '/brand/logos/logo-light.svg'

  const height = size ?? 32
  const width = Math.round(height * (150 / 32))

  return (
    <img
      src={src}
      alt="Свободно"
      className={className}
      width={width}
      height={height}
    />
  )
}
