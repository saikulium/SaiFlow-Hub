'use client'

import { useCallback, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { GO_NO_GO_CRITERIA } from '@/lib/constants/tenders'
import { useGoNoGoDecision } from '@/hooks/use-tender'
import { cn } from '@/lib/utils'
import type { GoNoGoScoreInput } from '@/types'

interface GoNoGoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenderId: string
}

type ScoreKey = keyof GoNoGoScoreInput

const INITIAL_SCORES: GoNoGoScoreInput = {
  margin: 0,
  technical: 0,
  experience: 0,
  risk: 0,
  workload: 0,
  strategic: 0,
}

function getRecommendation(total: number): {
  label: string
  color: string
  bgColor: string
} {
  if (total <= 40) {
    return { label: 'NO GO', color: 'text-red-400', bgColor: 'bg-red-400' }
  }
  if (total <= 60) {
    return { label: 'VALUTARE', color: 'text-amber-400', bgColor: 'bg-amber-400' }
  }
  return { label: 'GO', color: 'text-green-400', bgColor: 'bg-green-400' }
}

export function GoNoGoDialog({ open, onOpenChange, tenderId }: GoNoGoDialogProps) {
  const [scores, setScores] = useState<GoNoGoScoreInput>({ ...INITIAL_SCORES })
  const [notes, setNotes] = useState('')
  const goNoGoMutation = useGoNoGoDecision()

  const totalScore = useMemo(
    () =>
      scores.margin +
      scores.technical +
      scores.experience +
      scores.risk +
      scores.workload +
      scores.strategic,
    [scores],
  )

  const recommendation = useMemo(() => getRecommendation(totalScore), [totalScore])

  const handleScoreChange = useCallback((key: ScoreKey, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleDecision = useCallback(
    (decision: 'GO' | 'NO_GO') => {
      goNoGoMutation.mutate(
        {
          id: tenderId,
          decision,
          scores,
          notes: notes.trim() || undefined,
        },
        {
          onSuccess: () => {
            setScores({ ...INITIAL_SCORES })
            setNotes('')
            onOpenChange(false)
          },
        },
      )
    },
    [tenderId, scores, notes, goNoGoMutation, onOpenChange],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Valutazione Go / No-Go
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* Criteria sliders */}
          {GO_NO_GO_CRITERIA.map((criterion) => {
            const key = criterion.id as ScoreKey
            const value = scores[key]
            return (
              <div key={criterion.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-pf-text-primary">
                    {criterion.label}
                  </label>
                  <span className="text-sm font-semibold text-pf-text-primary">
                    {value}
                    <span className="text-pf-text-secondary">/{criterion.maxScore}</span>
                  </span>
                </div>
                <p className="text-xs text-pf-text-secondary">{criterion.description}</p>
                <input
                  type="range"
                  min={0}
                  max={criterion.maxScore}
                  value={value}
                  onChange={(e) => handleScoreChange(key, Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-pf-bg-tertiary accent-pf-accent"
                />
              </div>
            )
          })}

          {/* Total score bar */}
          <div className="space-y-2 rounded-card border border-pf-border bg-pf-bg-tertiary p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-pf-text-primary">
                Punteggio Totale
              </span>
              <span className={cn('text-lg font-bold', recommendation.color)}>
                {totalScore}/100
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-pf-bg-primary">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  recommendation.bgColor,
                )}
                style={{ width: `${totalScore}%` }}
              />
            </div>
            <p className={cn('text-center text-sm font-semibold', recommendation.color)}>
              Raccomandazione: {recommendation.label}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
              Note (opzionale)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="Motivazioni della decisione..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-pf-border px-6 py-4">
          <button
            type="button"
            onClick={() => handleDecision('NO_GO')}
            disabled={goNoGoMutation.isPending}
            className={cn(
              'rounded-button border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10',
              goNoGoMutation.isPending && 'cursor-not-allowed opacity-60',
            )}
          >
            Non Partecipare (No-Go)
          </button>
          <button
            type="button"
            onClick={() => handleDecision('GO')}
            disabled={goNoGoMutation.isPending}
            className={cn(
              'rounded-button bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-500',
              goNoGoMutation.isPending && 'cursor-not-allowed opacity-60',
            )}
          >
            Partecipare (Go)
          </button>
        </div>
      </div>
    </div>
  )
}
