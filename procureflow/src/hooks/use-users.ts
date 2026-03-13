'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateUserInput, UpdateUserRoleInput } from '@/lib/validations/auth'
import type { UserRole } from '@prisma/client'

interface UserItem {
  id: string
  name: string
  email: string
  role: UserRole
  department: string | null
  created_at: string
}

export function useUsers() {
  return useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Utente creato')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateUserRoleInput & { id: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Ruolo aggiornato')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
