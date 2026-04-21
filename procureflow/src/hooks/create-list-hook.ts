import { useQuery } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'

interface CreateListHookConfig {
  readonly endpoint: string
  readonly queryKey: string
  readonly errorMessage: string
}

/**
 * Factory for paginated list hooks.
 *
 * Standardises: URLSearchParams building, fetch + response validation,
 * useQuery wiring. Returns `ApiResponse<T[]>` with `data` and `meta`.
 *
 * Usage:
 * ```ts
 * export const useRequests = createListHook<RequestListItem, RequestsParams>({
 *   endpoint: '/api/requests',
 *   queryKey: 'requests',
 *   errorMessage: 'Errore nel caricamento delle richieste',
 * })
 * ```
 */
export function createListHook<TItem, TParams = Record<string, unknown>>(
  config: CreateListHookConfig,
) {
  return function useList(params: TParams = {} as TParams) {
    return useQuery<ApiResponse<TItem[]>>({
      queryKey: [config.queryKey, params],
      queryFn: async () => {
        const searchParams = new URLSearchParams()

        for (const [key, value] of Object.entries(
          params as Record<string, unknown>,
        )) {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value))
          }
        }

        const query = searchParams.toString()
        const url = `${config.endpoint}${query ? `?${query}` : ''}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(config.errorMessage)
        }

        const json: ApiResponse<TItem[]> = await response.json()

        if (!json.success) {
          throw new Error(json.error?.message ?? config.errorMessage)
        }

        return json
      },
    })
  }
}
