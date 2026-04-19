import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BasicForecast, AiForecast, MaterialAlertCard } from '@/types/ai'

export function useForecast(materialId: string | null) {
  const { data: forecast, isLoading } = useQuery<BasicForecast>({
    queryKey: ['forecast', materialId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/forecast/${materialId}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    enabled: !!materialId,
  })

  return { forecast, isLoading }
}

export function useAiForecast() {
  return useMutation<AiForecast, Error, string>({
    mutationFn: async (materialId) => {
      const res = await fetch(`/api/ai/forecast/${materialId}`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onError: () => toast.error('Errore nella previsione AI'),
  })
}

export function useMaterialAlerts() {
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery<MaterialAlertCard[]>({
    queryKey: ['material-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/ai/forecast/alerts')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/forecast/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['material-alerts'] }),
    onError: () => toast.error("Errore nel nascondere l'alert"),
  })

  return { alerts, isLoading, dismiss: dismissMutation.mutate }
}
