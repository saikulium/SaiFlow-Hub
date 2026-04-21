'use client'

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Download,
  FileArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface ImportResult {
  readonly created: number
  readonly updated: number
  readonly errors: readonly { row: number; message: string }[]
}

// --- ImportZone ---

function ImportZone({
  title,
  description,
  icon: Icon,
  endpoint,
}: {
  readonly title: string
  readonly description: string
  readonly icon: LucideIcon
  readonly endpoint: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json()) as {
        success: boolean
        data: ImportResult
        error?: { message: string }
      }
      if (!json.success) {
        throw new Error(json.error?.message ?? 'Errore importazione')
      }
      return json.data
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success(
        `Importazione completata: ${data.created} creati, ${data.updated} aggiornati`,
      )
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Errore importazione')
    },
  })

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setResult(null)
        importMutation.mutate(file)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [importMutation],
  )

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-pf-accent/10 flex h-10 w-10 items-center justify-center rounded-button text-pf-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-pf-text-primary">{title}</h3>
          <p className="text-xs text-pf-text-secondary">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
          className="inline-flex items-center gap-2 rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {importMutation.isPending ? 'Importazione...' : 'Carica CSV'}
        </button>
        <span className="text-xs text-pf-text-muted">
          Formato: CSV con intestazione nella prima riga
        </span>
      </div>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-2"
        >
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {result.created} creati
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {result.updated} aggiornati
            </span>
            {result.errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {result.errors.length} errori
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-button border border-red-400/20 bg-red-400/5 p-3">
              <p className="mb-1 text-xs font-medium text-red-400">Errori:</p>
              <ul className="space-y-0.5">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-300">
                    Riga {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// --- Export helpers ---

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Errore download')
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

function ExportButton({
  label,
  endpoint,
  filename,
}: {
  readonly label: string
  readonly endpoint: string
  readonly filename: string
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await downloadBlob(endpoint, filename)
      toast.success(`${label} esportati`)
    } catch {
      toast.error("Errore durante l'esportazione")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-button border border-pf-border px-3 py-2 text-sm font-medium transition-colors',
        loading
          ? 'cursor-not-allowed opacity-50'
          : 'text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary',
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  )
}

// --- Main Tab ---

export function ImportExportTab() {
  const [backupLoading, setBackupLoading] = useState(false)

  const handleBackup = async () => {
    setBackupLoading(true)
    try {
      await downloadBlob(
        '/api/admin/export/backup',
        `procureflow-backup-${new Date().toISOString().slice(0, 10)}.zip`,
      )
      toast.success('Backup scaricato')
    } catch {
      toast.error('Errore durante il backup')
    } finally {
      setBackupLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Import section */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Importazione Dati
        </h2>
        <div className="space-y-4">
          <ImportZone
            title="Importa Fornitori"
            description="Carica un file CSV con i dati dei fornitori"
            icon={Building2}
            endpoint="/api/admin/import/vendors"
          />
          <ImportZone
            title="Importa Materiali"
            description="Carica un file CSV con i dati dei materiali"
            icon={Package}
            endpoint="/api/admin/import/materials"
          />
        </div>
      </div>

      {/* Export section */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Esportazione Dati
        </h2>

        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          {/* Full backup */}
          <div className="mb-6">
            <h3 className="mb-1 text-sm font-medium text-pf-text-primary">
              Backup Completo
            </h3>
            <p className="mb-3 text-xs text-pf-text-secondary">
              Scarica un archivio ZIP con tutti i dati del sistema.
            </p>
            <button
              type="button"
              onClick={handleBackup}
              disabled={backupLoading}
              className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {backupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              {backupLoading ? 'Preparazione...' : 'Scarica Backup ZIP'}
            </button>
          </div>

          {/* Individual exports */}
          <div>
            <h3 className="mb-1 text-sm font-medium text-pf-text-primary">
              Esportazioni Singole
            </h3>
            <p className="mb-3 text-xs text-pf-text-secondary">
              Scarica CSV singoli per ogni entita.
            </p>
            <div className="flex flex-wrap gap-2">
              <ExportButton
                label="Fornitori"
                endpoint="/api/admin/export/vendors"
                filename="fornitori.csv"
              />
              <ExportButton
                label="Materiali"
                endpoint="/api/admin/export/materials"
                filename="materiali.csv"
              />
              <ExportButton
                label="Richieste"
                endpoint="/api/admin/export/requests"
                filename="richieste.csv"
              />
              <ExportButton
                label="Fatture"
                endpoint="/api/admin/export/invoices"
                filename="fatture.csv"
              />
              <ExportButton
                label="Utenti"
                endpoint="/api/admin/export/users"
                filename="utenti.csv"
              />
              <ExportButton
                label="Budget"
                endpoint="/api/admin/export/budgets"
                filename="budget.csv"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
