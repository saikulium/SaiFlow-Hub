import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { InsightCard } from '@/types/ai'

export function useInsights() {
  const queryClient = useQueryClient()

  const { data: insights = [], isLoading } = useQuery<InsightCard[]>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch('/api/ai/insights')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    refetchInterval: 5 * 60 * 1000,
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/insights/${id}`, { method: 'PATCH' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
    onError: () => {
      toast.error("Errore nel nascondere l'insight")
    },
  })

  return { insights, isLoading, dismiss: dismissMutation.mutate }
}
