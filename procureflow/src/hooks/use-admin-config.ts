'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateConfigInput } from '@/lib/validations/admin'

interface DeployConfigData {
  readonly deploy_name: string
  readonly company_logo_url: string | null
  readonly enabled_modules: readonly string[]
  readonly categories: readonly string[]
  readonly departments: readonly string[]
  readonly cost_centers: readonly string[]
  readonly approval_rules: {
    readonly autoApproveMax: number
    readonly managerApproveMax: number
  } | null
}

async function fetchConfig(): Promise<DeployConfigData> {
  const res = await fetch('/api/admin/config')
  const json = (await res.json()) as { success: boolean; data: DeployConfigData }
  if (!json.success) throw new Error('Errore caricamento configurazione')
  return json.data
}

async function updateConfig(data: UpdateConfigInput): Promise<DeployConfigData> {
  const res = await fetch('/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = (await res.json()) as { success: boolean; data: DeployConfigData }
  if (!json.success) throw new Error('Errore salvataggio configurazione')
  return json.data
}

export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchConfig,
  })
}

export function useUpdateAdminConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
  })
}
