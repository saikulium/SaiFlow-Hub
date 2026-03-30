'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, Loader2, Save, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'
import { MODULE_REGISTRY } from '@/lib/modules/registry'
import { cn } from '@/lib/utils'

function SkeletonBlock() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 animate-pulse rounded bg-pf-border" />
      <div className="h-10 w-full animate-pulse rounded-button bg-pf-border" />
      <div className="h-5 w-32 animate-pulse rounded bg-pf-border" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-pf-border" />
        ))}
      </div>
    </div>
  )
}

export function GeneralTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [deployName, setDeployName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync local state with fetched config
  useEffect(() => {
    if (config) {
      setDeployName(config.deploy_name)
      setLogoUrl(config.company_logo_url)
      setEnabledModules([...config.enabled_modules])
    }
  }, [config])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 500_000) {
      toast.error('Immagine troppo grande (max 500KB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setLogoUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleModuleToggle = (moduleId: string) => {
    if (moduleId === 'core') return
    setEnabledModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId],
    )
  }

  const handleSave = () => {
    updateConfig.mutate(
      {
        deploy_name: deployName,
        company_logo_url: logoUrl,
        enabled_modules: enabledModules,
      },
      {
        onSuccess: () => toast.success('Configurazione salvata'),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <SkeletonBlock />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Company name */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Informazioni Aziendali
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="deploy_name"
              className="mb-1.5 block text-sm text-pf-text-secondary"
            >
              Nome Azienda
            </label>
            <input
              id="deploy_name"
              type="text"
              value={deployName}
              onChange={(e) => setDeployName(e.target.value)}
              placeholder="Nome della tua organizzazione"
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
          </div>

          {/* Logo upload */}
          <div>
            <label className="mb-1.5 block text-sm text-pf-text-secondary">
              Logo Aziendale
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-pf-border bg-pf-bg-primary">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo aziendale"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-pf-text-muted" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-button border border-pf-border px-3 py-1.5 text-sm text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Carica Logo
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="ml-2 text-xs text-red-400 hover:text-red-300"
                  >
                    Rimuovi
                  </button>
                )}
                <p className="mt-1 text-xs text-pf-text-muted">
                  PNG, JPEG o SVG. Max 500KB.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module toggles */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Moduli Attivi
        </h2>
        <p className="mb-4 text-xs text-pf-text-secondary">
          Abilita o disabilita i moduli del sistema. Il modulo Core e sempre attivo.
        </p>
        <div className="space-y-2">
          {Array.from(MODULE_REGISTRY.values()).map((mod) => {
            const isCore = mod.id === 'core'
            const isEnabled = enabledModules.includes(mod.id)
            return (
              <motion.label
                key={mod.id}
                whileHover={{ scale: isCore ? 1 : 1.005 }}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-button border px-4 py-3 transition-colors',
                  isEnabled
                    ? 'border-pf-accent/20 bg-pf-accent/5'
                    : 'border-pf-border bg-pf-bg-primary',
                  isCore && 'cursor-default opacity-70',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pf-text-primary">
                    {mod.label}
                  </p>
                  <p className="text-xs text-pf-text-secondary">
                    {mod.description}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={isCore}
                  onChange={() => handleModuleToggle(mod.id)}
                  className="h-4 w-4 shrink-0 rounded border-pf-border bg-pf-bg-primary text-pf-accent accent-pf-accent focus:ring-2 focus:ring-pf-accent disabled:opacity-50"
                />
              </motion.label>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva Configurazione
        </button>
      </div>
    </div>
  )
}
