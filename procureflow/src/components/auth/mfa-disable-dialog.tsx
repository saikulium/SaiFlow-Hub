'use client'

import { useState } from 'react'
import { Loader2, ShieldOff } from 'lucide-react'
import { useMfaDisable } from '@/hooks/use-mfa'

interface MfaDisableDialogProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function MfaDisableDialog({
  open,
  onClose,
  onComplete,
}: MfaDisableDialogProps) {
  const [code, setCode] = useState('')
  const { disable, isLoading, error } = useMfaDisable()

  async function handleDisable() {
    const success = await disable(code)
    if (success) {
      setCode('')
      onComplete()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-red-400" />
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Disattiva MFA
          </h2>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-pf-text-secondary">
            Inserisci un codice TOTP valido per confermare la disattivazione.
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-center font-mono text-lg tracking-widest text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            placeholder="000000"
            autoFocus
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-button border border-pf-border px-4 py-2 text-sm text-pf-text-primary transition-colors hover:bg-pf-bg-hover"
            >
              Annulla
            </button>
            <button
              onClick={handleDisable}
              disabled={isLoading || code.length !== 6}
              className="flex flex-1 items-center justify-center gap-2 rounded-button bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Disattiva
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
