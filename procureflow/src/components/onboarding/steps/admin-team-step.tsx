'use client'

import { useState } from 'react'
import { Users, Plus, X, Copy, Check } from 'lucide-react'
import { useInviteTeam } from '@/hooks/use-onboarding'
import type { TeamInviteResult } from '@/types/onboarding'

interface InviteRow {
  name: string
  email: string
  role: 'REQUESTER' | 'MANAGER' | 'VIEWER'
}

const EMPTY_ROW: InviteRow = { name: '', email: '', role: 'REQUESTER' }

export function AdminTeamStep() {
  const [rows, setRows] = useState<InviteRow[]>([{ ...EMPTY_ROW }])
  const [results, setResults] = useState<TeamInviteResult[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const inviteTeam = useInviteTeam()

  function updateRow(index: number, field: keyof InviteRow, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleInvite() {
    const validRows = rows.filter((r) => r.name.trim() && r.email.trim())
    if (validRows.length === 0) return
    const data = await inviteTeam.mutateAsync({ invites: validRows })
    setResults(data)
  }

  function copyPassword(password: string, idx: number) {
    navigator.clipboard.writeText(password)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (results.length > 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-pf-text-primary">
            Team Invitato
          </h2>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Condividi le password con i tuoi colleghi — sono visibili solo ora
          </p>
        </div>
        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={r.email}
              className={`rounded-lg border p-3 ${r.success ? 'border-pf-success/30 bg-pf-success/5' : 'border-pf-danger/30 bg-pf-danger/5'}`}
            >
              <p className="text-sm font-medium text-pf-text-primary">{r.email}</p>
              {r.success ? (
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-pf-bg-tertiary px-2 py-1 font-mono text-xs text-pf-text-secondary">
                    {r.password}
                  </code>
                  <button
                    onClick={() => copyPassword(r.password, i)}
                    className="rounded p-1 text-pf-text-muted transition-colors hover:text-pf-text-primary"
                  >
                    {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-pf-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-pf-danger">{r.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Users className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Invita il Team
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Aggiungi i colleghi che useranno ProcureFlow
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                placeholder="Nome"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
              />
              <input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(i, 'email', e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
              />
            </div>
            <select
              value={row.role}
              onChange={(e) => updateRow(i, 'role', e.target.value)}
              className="rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
            >
              <option value="REQUESTER">Richiedente</option>
              <option value="MANAGER">Manager</option>
              <option value="VIEWER">Osservatore</option>
            </select>
            {rows.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                className="mt-2 rounded p-1 text-pf-text-muted transition-colors hover:text-pf-danger"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-pf-border py-2 text-sm text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent"
        >
          <Plus className="h-4 w-4" />
          Aggiungi altro
        </button>
      </div>

      <button
        onClick={handleInvite}
        disabled={inviteTeam.isPending || !rows.some((r) => r.name.trim() && r.email.trim())}
        className="w-full rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
      >
        {inviteTeam.isPending ? 'Invio...' : 'Invia inviti'}
      </button>
    </div>
  )
}
