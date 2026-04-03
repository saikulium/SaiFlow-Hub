'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Upload, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useImportArticles } from '@/hooks/use-articles'
import { cn } from '@/lib/utils'
import type { ArticleImportResult } from '@/types'

interface ArticleImportDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

type Step = 'upload' | 'preview' | 'import'

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headerLine = lines[0]
  if (!headerLine) return []
  const headers = headerLine
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] || ''
    })
    return row
  })
}

function countUniqueArticles(rows: readonly Record<string, string>[]): number {
  const codes = new Set<string>()
  for (const row of rows) {
    const code = row['codice_interno']
    if (code) codes.add(code)
  }
  return codes.size
}

export function ArticleImportDialog({
  open,
  onOpenChange,
}: ArticleImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [result, setResult] = useState<ArticleImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importMutation = useImportArticles()

  const resetState = useCallback(() => {
    setStep('upload')
    setRows([])
    setResult(null)
    setDragOver(false)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') return
      const parsed = parseCsv(text)
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.csv')) {
        handleFile(file)
      }
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleImport = useCallback(async () => {
    setStep('import')
    try {
      const response = await importMutation.mutateAsync(rows)
      setResult(response.data)
    } catch {
      // Error handled by mutation state
    }
  }, [rows, importMutation])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-pf-border bg-pf-bg-secondary p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-pf-text-primary">
            Importa Articoli da CSV
          </h2>
          <button
            onClick={handleClose}
            className="rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="mb-6 flex items-center gap-2">
          {(['upload', 'preview', 'import'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-pf-border" />}
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  step === s
                    ? 'bg-pf-accent text-white'
                    : 'bg-pf-bg-tertiary text-pf-text-muted',
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'text-xs',
                  step === s
                    ? 'font-medium text-pf-text-primary'
                    : 'text-pf-text-muted',
                )}
              >
                {s === 'upload'
                  ? 'Carica'
                  : s === 'preview'
                    ? 'Anteprima'
                    : 'Importa'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-card border-2 border-dashed p-12 transition-colors',
              dragOver
                ? 'bg-pf-accent/5 border-pf-accent'
                : 'border-pf-border hover:border-pf-border-hover',
            )}
          >
            <Upload className="mb-3 h-10 w-10 text-pf-text-muted" />
            <p className="text-sm font-medium text-pf-text-primary">
              Trascina un file CSV qui
            </p>
            <p className="mt-1 text-xs text-pf-text-muted">oppure</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              Seleziona file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
            <p className="mt-4 text-xs text-pf-text-muted">
              Colonne: codice_interno, nome, categoria, um, produttore,
              codice_produttore, tipo_alias, codice_alias, entita, note_alias
            </p>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-pf-bg-tertiary px-3 py-1 text-xs font-medium text-pf-text-secondary">
                {rows.length} righe
              </span>
              <span className="rounded-full bg-pf-bg-tertiary px-3 py-1 text-xs font-medium text-pf-text-secondary">
                {countUniqueArticles(rows)} articoli unici
              </span>
            </div>

            <div className="max-h-64 overflow-auto rounded-card border border-pf-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-pf-border bg-pf-bg-tertiary">
                    {rows.length > 0 &&
                      rows[0] &&
                      Object.keys(rows[0]).map((header) => (
                        <th
                          key={header}
                          className="whitespace-nowrap px-3 py-2 text-left font-medium text-pf-text-secondary"
                        >
                          {header}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                    >
                      {Object.values(row).map((val, j) => (
                        <td
                          key={j}
                          className="whitespace-nowrap px-3 py-1.5 text-pf-text-primary"
                        >
                          {val || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="px-3 py-2 text-xs text-pf-text-muted">
                  ...e altre {rows.length - 10} righe
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setStep('upload')}
                className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
              >
                Indietro
              </button>
              <button
                onClick={handleImport}
                className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
              >
                Importa {rows.length} righe
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Import */}
        {step === 'import' && (
          <div className="flex flex-col items-center py-8">
            {importMutation.isPending && (
              <>
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-pf-accent" />
                <p className="text-sm font-medium text-pf-text-primary">
                  Importazione in corso...
                </p>
                <p className="mt-1 text-xs text-pf-text-muted">
                  Attendere il completamento
                </p>
              </>
            )}

            {importMutation.isError && (
              <>
                <AlertTriangle className="mb-4 h-10 w-10 text-red-400" />
                <p className="text-sm font-medium text-pf-text-primary">
                  Errore durante l&apos;importazione
                </p>
                <p className="mt-1 text-xs text-pf-text-muted">
                  {importMutation.error?.message ?? 'Errore sconosciuto'}
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setStep('preview')}
                    className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                  >
                    Indietro
                  </button>
                  <button
                    onClick={handleImport}
                    className="rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
                  >
                    Riprova
                  </button>
                </div>
              </>
            )}

            {result && (
              <>
                <CheckCircle className="mb-4 h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium text-pf-text-primary">
                  Importazione completata
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                  <div className="rounded-card border border-pf-border bg-pf-bg-tertiary p-3">
                    <p className="font-display text-xl font-bold text-pf-text-primary">
                      {result.articles_created}
                    </p>
                    <p className="text-xs text-pf-text-muted">
                      Articoli creati
                    </p>
                  </div>
                  <div className="rounded-card border border-pf-border bg-pf-bg-tertiary p-3">
                    <p className="font-display text-xl font-bold text-pf-text-primary">
                      {result.aliases_created}
                    </p>
                    <p className="text-xs text-pf-text-muted">Alias creati</p>
                  </div>
                  <div className="rounded-card border border-pf-border bg-pf-bg-tertiary p-3">
                    <p className="font-display text-xl font-bold text-pf-text-primary">
                      {result.skipped}
                    </p>
                    <p className="text-xs text-pf-text-muted">Saltati</p>
                  </div>
                  <div className="rounded-card border border-pf-border bg-pf-bg-tertiary p-3">
                    <p className="font-display text-xl font-bold text-pf-text-primary">
                      {result.errors.length}
                    </p>
                    <p className="text-xs text-pf-text-muted">Errori</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 max-h-32 w-full overflow-auto rounded-card border border-red-400/20 bg-red-400/5 p-3 text-left">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-300">
                        Riga {err.row}: {err.field} — {err.message}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="mt-6 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
                >
                  Chiudi
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
