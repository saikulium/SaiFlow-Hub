'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface CommentAuthor {
  id: string
  name: string
  role: string
}

interface Comment {
  id: string
  content: string
  is_internal: boolean
  created_at: string
  author: CommentAuthor
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function fetchComments(requestId: string): Promise<Comment[]> {
  const res = await fetch(`/api/requests/${requestId}/comments`)
  if (!res.ok) throw new Error('Errore nel caricamento dei commenti')
  const json: ApiResponse<Comment[]> = await res.json()
  if (!json.success) throw new Error('Errore nel caricamento dei commenti')
  return json.data
}

async function postComment(
  requestId: string,
  body: { content: string; is_internal: boolean },
): Promise<Comment> {
  const res = await fetch(`/api/requests/${requestId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? 'Errore nella creazione del commento')
  }
  const json: ApiResponse<Comment> = await res.json()
  return json.data
}

export function useComments(requestId: string) {
  return useQuery({
    queryKey: ['comments', requestId],
    queryFn: () => fetchComments(requestId),
    enabled: Boolean(requestId),
  })
}

export function useCreateComment(requestId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: { content: string; is_internal: boolean }) =>
      postComment(requestId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', requestId] })
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
    },
  })
}

export type { Comment, CommentAuthor }
