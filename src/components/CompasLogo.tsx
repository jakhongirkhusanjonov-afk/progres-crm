'use client'

import Image from 'next/image'

interface CompasLogoProps {
  width?: number
  height?: number
  className?: string
  showText?: boolean
  textClassName?: string
}

export default function CompasLogo({
  width = 60,
  height = 60,
  className = '',
  showText = false,
  textClassName = 'text-xl font-bold text-orange-600'
}: CompasLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/compas-logo.svg"
        alt="COMPAS - Rivojlanish markazi"
        width={width}
        height={height}
        className="flex-shrink-0"
        priority
      />

      {showText && (
        <span className={textClassName}>COMPAS</span>
      )}
    </div>
  )
}
