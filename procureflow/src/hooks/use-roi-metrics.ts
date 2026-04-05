'use client'

import { useQuery } from '@tanstack/react-query'
import type { RoiMetrics, RoiPeriod } from '@/types'

interface RoiResponse {
  readonly success: boolean
  readonly data: RoiMetrics | null
}

async function fetchRoiMetrics(period: RoiPeriod): Promise<RoiResponse> {
  const res = await fetch(`/api/analytics/roi?period=${period}`)
  if (!res.ok) {
    throw new Error('Errore nel caricamento metriche ROI')
  }
  return res.json()
}

export function useRoiMetrics(period: RoiPeriod = '90d') {
  return useQuery({
    queryKey: ['roi-metrics', period],
    queryFn: () => fetchRoiMetrics(period),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
