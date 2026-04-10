'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ArticleListItem,
  ArticleDetail,
  ArticleImportResult,
  ArticleStockInfo,
} from '@/types'
import type {
  ArticleQuery,
  CreateArticleInput,
  UpdateArticleInput,
  CreateAliasInput,
  CreatePriceInput,
} from '@/lib/validations/article'

interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: { total: number; page: number; pageSize: number }
}

async function fetchArticles(
  params?: Partial<ArticleQuery>,
): Promise<ApiResponse<ArticleListItem[]>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params?.search) searchParams.set('search', params.search)
  if (params?.category) searchParams.set('category', params.category)
  if (params?.is_active !== undefined)
    searchParams.set('is_active', String(params.is_active))
  if (params?.verified !== undefined)
    searchParams.set('verified', String(params.verified))
  if (params?.sort) searchParams.set('sort', params.sort)
  if (params?.order) searchParams.set('order', params.order)

  const res = await fetch(`/api/articles?${searchParams}`)
  if (!res.ok) throw new Error('Errore caricamento articoli')
  return res.json()
}

async function fetchArticle(id: string): Promise<ArticleDetail> {
  const res = await fetch(`/api/articles/${id}`)
  if (!res.ok) throw new Error('Errore caricamento articolo')
  const json: ApiResponse<ArticleDetail> = await res.json()
  if (!json.success) throw new Error('Articolo non trovato')
  return json.data
}

async function createArticle(
  data: CreateArticleInput,
): Promise<ApiResponse<ArticleDetail>> {
  const res = await fetch('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore creazione articolo')
  return res.json()
}

async function updateArticle({
  id,
  data,
}: {
  id: string
  data: UpdateArticleInput
}): Promise<ApiResponse<ArticleDetail>> {
  const res = await fetch(`/api/articles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore aggiornamento articolo')
  return res.json()
}

async function deleteArticle(
  id: string,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Errore eliminazione articolo')
  return res.json()
}

async function addAlias({
  articleId,
  data,
}: {
  articleId: string
  data: CreateAliasInput
}): Promise<ApiResponse<unknown>> {
  const res = await fetch(`/api/articles/${articleId}/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore aggiunta alias')
  return res.json()
}

async function deleteAlias({
  articleId,
  aliasId,
}: {
  articleId: string
  aliasId: string
}): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`/api/articles/${articleId}/aliases/${aliasId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Errore eliminazione alias')
  return res.json()
}

async function addPrice({
  articleId,
  data,
}: {
  articleId: string
  data: CreatePriceInput
}): Promise<ApiResponse<unknown>> {
  const res = await fetch(`/api/articles/${articleId}/prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore aggiunta prezzo')
  return res.json()
}

async function importArticlesApi(
  rows: readonly Record<string, string>[],
): Promise<ApiResponse<ArticleImportResult>> {
  const res = await fetch('/api/articles/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error?.message ?? `Errore import (${res.status})`
    throw new Error(msg)
  }
  return res.json()
}

export function useArticles(params?: Partial<ArticleQuery>) {
  return useQuery({
    queryKey: ['articles', params],
    queryFn: () => fetchArticles(params),
  })
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id),
    enabled: Boolean(id),
  })
}

export function useCreateArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useUpdateArticle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateArticleInput) => updateArticle({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useDeleteArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useAddAlias(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAliasInput) => addAlias({ articleId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
    },
  })
}

export function useDeleteAlias(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (aliasId: string) => deleteAlias({ articleId, aliasId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
    },
  })
}

export function useAddPrice(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePriceInput) => addPrice({ articleId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
    },
  })
}

export function useImportArticles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importArticlesApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Stock hooks
// ---------------------------------------------------------------------------

async function fetchArticleStock(articleId: string): Promise<ArticleStockInfo> {
  const res = await fetch(`/api/articles/${articleId}/stock`)
  if (!res.ok) throw new Error('Errore caricamento stock')
  const json: ApiResponse<ArticleStockInfo> = await res.json()
  if (!json.success) throw new Error('Errore dati stock')
  return json.data!
}

interface StockMovementInput {
  readonly type: 'INBOUND' | 'OUTBOUND'
  readonly quantity: number
  readonly unit_cost?: number
  readonly notes?: string
}

async function postStockMovement({
  articleId,
  data,
}: {
  articleId: string
  data: StockMovementInput
}): Promise<ApiResponse<unknown>> {
  const res = await fetch(`/api/articles/${articleId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Errore movimento stock')
  }
  return res.json()
}

export function useArticleStock(articleId: string) {
  return useQuery({
    queryKey: ['article-stock', articleId],
    queryFn: () => fetchArticleStock(articleId),
    enabled: Boolean(articleId),
  })
}

export function useStockMovement(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: StockMovementInput) =>
      postStockMovement({ articleId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article-stock', articleId] })
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
      queryClient.invalidateQueries({ queryKey: ['materials'] })
    },
  })
}
