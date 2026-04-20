'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface CountUpNumberProps {
  value: number
  format?: 'number' | 'currency'
  duration?: number
}

export function CountUpNumber({
  value,
  format = 'number',
  duration = 1500,
}: CountUpNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (!isInView) return

    const startTime = performance.now()

    function update(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(value * eased))

      if (progress < 1) {
        requestAnimationFrame(update)
      }
    }

    requestAnimationFrame(update)
  }, [isInView, value, duration])

  const formatted =
    format === 'currency'
      ? formatCurrency(displayValue)
      : displayValue.toLocaleString('it-IT')

  return <span ref={ref}>{formatted}</span>
}
