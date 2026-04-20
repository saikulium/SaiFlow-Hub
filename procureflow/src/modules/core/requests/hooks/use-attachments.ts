'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Attachment {
  id: string
  filename: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function fetchAttachments(requestId: string): Promise<Attachment[]> {
  const res = await fetch(`/api/requests/${requestId}/attachments`)
  if (!res.ok) throw new Error('Errore nel caricamento degli allegati')
  const json: ApiResponse<Attachment[]> = await res.json()
  if (!json.success) throw new Error('Errore nel caricamento degli allegati')
  return json.data
}

async function uploadAttachment(
  requestId: string,
  file: File,
): Promise<Attachment> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`/api/requests/${requestId}/attachments`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? "Errore nell'upload del file")
  }
  const json: ApiResponse<Attachment> = await res.json()
  return json.data
}

export function useAttachments(requestId: string) {
  return useQuery({
    queryKey: ['attachments', requestId],
    queryFn: () => fetchAttachments(requestId),
    enabled: Boolean(requestId),
  })
}

export function useUploadAttachment(requestId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => uploadAttachment(requestId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', requestId] })
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
    },
  })
}

export type { Attachment }
