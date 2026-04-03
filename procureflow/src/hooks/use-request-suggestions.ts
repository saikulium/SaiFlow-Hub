import { useQuery } from '@tanstack/react-query'
import type { RequestSuggestion } from '@/server/services/suggest.service'

export function useRequestSuggestions(title: string) {
  return useQuery<{ data: RequestSuggestion | null }>({
    queryKey: ['request-suggestions', title],
    queryFn: async () => ({ data: null }),
    enabled: false,
  })
}
