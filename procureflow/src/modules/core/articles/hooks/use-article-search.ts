'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ArticleSearchResult } from '@/types'

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function searchArticles(q: string, limit = 10): Promise<ArticleSearchResult[]> {
  if (!q || q.length < 1) return []
  const res = await fetch(`/api/articles/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  if (!res.ok) return []
  const json: ApiResponse<ArticleSearchResult[]> = await res.json()
  return json.success ? json.data : []
}

export function useArticleSearch(query: string, limit = 10) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  return useQuery({
    queryKey: ['article-search', debouncedQuery, limit],
    queryFn: () => searchArticles(debouncedQuery, limit),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  })
}
