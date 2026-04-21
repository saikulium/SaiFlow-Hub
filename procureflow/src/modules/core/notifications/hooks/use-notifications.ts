'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface NotificationItem {
  id: string
  title: string
  body: string
  type: string
  link: string | null
  read: boolean
  created_at: string
}

interface NotificationsResponse {
  success: boolean
  data: NotificationItem[]
  meta?: {
    total: number
    page: number
    pageSize: number
    unread_count: number
  }
}

async function fetchNotifications(): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
}> {
  const res = await fetch('/api/notifications?pageSize=20')
  if (!res.ok) throw new Error('Errore nel caricamento delle notifiche')
  const json: NotificationsResponse = await res.json()
  if (!json.success) throw new Error('Errore nel caricamento delle notifiche')
  return {
    notifications: json.data,
    unreadCount: json.meta?.unread_count ?? 0,
  }
}

async function markNotificationsRead(ids: string[]): Promise<void> {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error('Errore nel segnare come lette')
}

async function markSingleRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}`, {
    method: 'PATCH',
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Poll ogni 30 secondi
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkSingleRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => markSingleRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const prev = queryClient.getQueryData<{
        notifications: NotificationItem[]
        unreadCount: number
      }>(['notifications'])

      if (prev) {
        queryClient.setQueryData(['notifications'], {
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        })
      }
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['notifications'], context.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export type { NotificationItem }
