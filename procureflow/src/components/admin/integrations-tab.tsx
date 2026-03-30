'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  FileText,
  Plug,
  ChevronDown,
  Loader2,
  Save,
  Wifi,
  WifiOff,
  CircleDashed,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface IntegrationConfig {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly enabled: boolean
  readonly config: Record<string, unknown>
  readonly last_health_check: string | null
  readonly health_status: 'ok' | 'error' | null
}

interface IntegrationField {
  readonly key: string
  readonly label: string
  readonly type: 'text' | 'number' | 'email' | 'password' | 'select'
  readonly placeholder?: string
  readonly options?: readonly string[]
  readonly required?: boolean
}

// --- Constants ---

const INTEGRATION_META: Record<
  string,
  { label: string; icon: LucideIcon; description: string }
> = {
  imap: {
    label: 'Email IMAP',
    icon: Mail,
    description: 'Polling email per ingestion automatica fatture e notifiche',
  },
  sdi: {
    label: 'SDI (Fatturazione Elettronica)',
    icon: FileText,
    description: 'Collegamento al Sistema di Interscambio per fatture elettroniche',
  },
  vendor_api: {
    label: 'API Fornitore',
    icon: Plug,
    description: 'Integrazione API diretta con portali fornitori',
  },
}

const INTEGRATION_FIELDS: Record<string, readonly IntegrationField[]> = {
  imap: [
    { key: 'host', label: 'Host', type: 'text', placeholder: 'imap.example.com', required: true },
    { key: 'port', label: 'Porta', type: 'number', placeholder: '993', required: true },
    { key: 'protocol', label: 'Protocollo', type: 'select', options: ['imap', 'imaps'], required: true },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'inbox@example.com', required: true },
    { key: 'password', label: 'Password', type: 'password', placeholder: 'password', required: true },
    { key: 'folder', label: 'Cartella', type: 'text', placeholder: 'INBOX' },
  ],
  sdi: [
    { key: 'endpoint_url', label: 'URL Endpoint', type: 'text', placeholder: 'https://sdi.example.com', required: true },
    { key: 'codice_destinatario', label: 'Codice Destinatario', type: 'text', placeholder: 'ABC1234', required: true },
    { key: 'certificate_base64', label: 'Certificato (Base64)', type: 'text', placeholder: 'Base64 del certificato...' },
    { key: 'certificate_password', label: 'Password Certificato', type: 'password', placeholder: 'password certificato' },
  ],
  vendor_api: [
    { key: 'vendor_name', label: 'Nome Fornitore', type: 'text', placeholder: 'Nome portale', required: true },
    { key: 'base_url', label: 'URL Base', type: 'text', placeholder: 'https://api.fornitore.com', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Chiave API', required: true },
  ],
}

const INTEGRATION_TYPES = ['imap', 'sdi', 'vendor_api'] as const

// --- Data fetching ---

async function fetchIntegrations(): Promise<IntegrationConfig[]> {
  const res = await fetch('/api/admin/integrations')
  const json = (await res.json()) as {
    success: boolean
    data: IntegrationConfig[]
  }
  if (!json.success) throw new Error('Errore caricamento integrazioni')
  return json.data
}

// --- Components ---

function StatusBadge({
  status,
}: {
  readonly status: 'ok' | 'error' | null
}) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-badge bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">
        <Wifi className="h-3 w-3" />
        Connesso
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-badge bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-400">
        <WifiOff className="h-3 w-3" />
        Errore
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-badge bg-zinc-400/10 px-2 py-0.5 text-xs font-medium text-pf-text-muted">
      <CircleDashed className="h-3 w-3" />
      Non testato
    </span>
  )
}

function IntegrationCard({
  type,
  integration,
}: {
  readonly type: string
  readonly integration: IntegrationConfig | undefined
}) {
  const queryClient = useQueryClient()
  const meta = INTEGRATION_META[type]
  const fields = INTEGRATION_FIELDS[type] ?? []
  const Icon = meta?.icon ?? Plug

  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(integration?.enabled ?? false)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>(
    () => ({ ...(integration?.config ?? {}) }),
  )

  useEffect(() => {
    if (integration) {
      setEnabled(integration.enabled)
      setConfigValues({ ...integration.config })
    }
  }, [integration])

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/integrations/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: meta?.label ?? type,
          enabled,
          config: configValues,
        }),
      })
      const json = (await res.json()) as { success: boolean }
      if (!json.success) throw new Error('Errore salvataggio')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] })
      toast.success(`${meta?.label ?? type} salvata`)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Errore'),
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/integrations/${type}/test`, {
        method: 'POST',
      })
      const json = (await res.json()) as {
        success: boolean
        data?: { status: string }
      }
      if (!json.success) throw new Error('Test fallito')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] })
      toast.success('Connessione riuscita')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Errore test'),
  })

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between p-5"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-button',
              enabled ? 'bg-pf-accent/10 text-pf-accent' : 'bg-pf-bg-primary text-pf-text-muted',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-pf-text-primary">
              {meta?.label ?? type}
            </p>
            <p className="text-xs text-pf-text-secondary">
              {meta?.description ?? ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={integration?.health_status ?? null} />
          <ChevronDown
            className={cn(
              'h-4 w-4 text-pf-text-secondary transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      {/* Expanded config */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-pf-border px-5 pb-5 pt-4">
              {/* Enable toggle */}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-pf-border bg-pf-bg-primary text-pf-accent accent-pf-accent focus:ring-2 focus:ring-pf-accent"
                />
                <span className="text-sm text-pf-text-primary">
                  Integrazione attiva
                </span>
              </label>

              {/* Config fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs text-pf-text-secondary">
                      {field.label}
                      {field.required && (
                        <span className="ml-0.5 text-red-400">*</span>
                      )}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={(configValues[field.key] as string) ?? ''}
                        onChange={(e) =>
                          handleFieldChange(field.key, e.target.value)
                        }
                        className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                      >
                        <option value="">Seleziona...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={
                          field.type === 'number'
                            ? (configValues[field.key] as number) ?? ''
                            : (configValues[field.key] as string) ?? ''
                        }
                        onChange={(e) =>
                          handleFieldChange(
                            field.key,
                            field.type === 'number'
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                        className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-pf-accent"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salva
                </button>
                <button
                  type="button"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !integration}
                  className="inline-flex items-center gap-2 rounded-button border border-pf-border px-3 py-1.5 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Test Connessione
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-button bg-pf-border" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-pf-border" />
          <div className="h-3 w-48 animate-pulse rounded bg-pf-border" />
        </div>
      </div>
    </div>
  )
}

// --- Main Tab ---

export function IntegrationsTab() {
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: fetchIntegrations,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-pf-text-primary">
          Integrazioni Esterne
        </h2>
        <p className="mt-0.5 text-xs text-pf-text-secondary">
          Configura le connessioni con sistemi esterni (email, SDI, API
          fornitori).
        </p>
      </div>

      {INTEGRATION_TYPES.map((type) => {
        const integration = integrations?.find((i) => i.type === type)
        return (
          <IntegrationCard
            key={type}
            type={type}
            integration={integration}
          />
        )
      })}
    </div>
  )
}
