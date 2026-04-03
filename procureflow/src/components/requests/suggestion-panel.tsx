'use client'

import type { RequestSuggestion } from '@/server/services/suggest.service'

interface SuggestionPanelProps {
  readonly suggestion: RequestSuggestion | null
  readonly isLoading: boolean
  readonly onAcceptField: (field: string, value: unknown) => void
  readonly onAcceptAll: () => void
  readonly onDismiss: () => void
}

export function SuggestionPanel({
  suggestion,
  isLoading,
  onAcceptField,
  onAcceptAll,
  onDismiss,
}: SuggestionPanelProps) {
  // Stub — SmartFill suggestions not yet implemented on this branch
  return null
}
