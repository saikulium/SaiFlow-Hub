'use client'

import { useQuery } from '@tanstack/react-query'

interface UnverifiedCountResponse {
  readonly success: boolean
  readonly data: { readonly count: number }
}

async function fetchUnverifiedCount(): Promise<number> {
  const res = await fetch('/api/articles/unverified/count')
  if (!res.ok) return 0
  const json: UnverifiedCountResponse = await res.json()
  return json.data?.count ?? 0
}

export function useUnverifiedArticlesCount() {
  return useQuery<number>({
    queryKey: ['articles-unverified-count'],
    queryFn: fetchUnverifiedCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
