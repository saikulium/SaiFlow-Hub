'use client'

import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/use-debounce'
import { useModules } from '@/components/providers/modules-provider'
import type { RequestSuggestion } from '@/server/services/suggest.service'

interface SuggestResponse {
  readonly success: boolean
  readonly data: RequestSuggestion | null
}

async function fetchSuggestions(title: string): Promise<SuggestResponse> {
  const res = await fetch('/api/requests/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })

  if (!res.ok) {
    throw new Error('Errore nel caricamento suggerimenti')
  }

  return res.json()
}

export function useRequestSuggestions(title: string) {
  const debouncedTitle = useDebounce(title, 600)
  const { isModuleEnabled } = useModules()
  const enabled = isModuleEnabled('smartfill')

  return useQuery({
    queryKey: ['request-suggestions', debouncedTitle],
    queryFn: () => fetchSuggestions(debouncedTitle),
    enabled: enabled && debouncedTitle.length >= 3,
    staleTime: 30_000,
    retry: false,
  })
}
