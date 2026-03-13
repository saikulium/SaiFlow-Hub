'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Search, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/constants'
import { useModules } from '@/hooks/use-modules'
import { filterNavItems } from '@/lib/modules/helpers'

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { enabledModules } = useModules()
  const visibleNavItems = filterNavItems(enabledModules, NAV_ITEMS)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="flex items-start justify-center pt-[20vh]">
        <Command
          className="relative w-full max-w-lg overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary shadow-2xl"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <div className="flex items-center border-b border-pf-border px-4">
            <Search className="mr-2 h-4 w-4 shrink-0 text-pf-text-muted" />
            <Command.Input
              placeholder="Cerca richieste, fornitori, azioni..."
              className="flex h-12 w-full bg-transparent text-sm text-pf-text-primary outline-none placeholder:text-pf-text-muted"
              autoFocus
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-pf-text-muted">
              Nessun risultato trovato.
            </Command.Empty>

            <Command.Group
              heading="Azioni Rapide"
              className="px-2 py-1.5 text-xs font-semibold text-pf-text-muted"
            >
              <Command.Item
                onSelect={() => navigate('/requests/new')}
                className="flex cursor-pointer items-center gap-3 rounded-button px-3 py-2.5 text-sm text-pf-text-secondary transition-colors data-[selected=true]:bg-pf-bg-hover data-[selected=true]:text-pf-text-primary"
              >
                <Plus className="h-4 w-4" />
                Nuova Richiesta
              </Command.Item>
            </Command.Group>

            <Command.Group
              heading="Navigazione"
              className="px-2 py-1.5 text-xs font-semibold text-pf-text-muted"
            >
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <Command.Item
                    key={item.href}
                    onSelect={() => navigate(item.href)}
                    className="flex cursor-pointer items-center gap-3 rounded-button px-3 py-2.5 text-sm text-pf-text-secondary transition-colors data-[selected=true]:bg-pf-bg-hover data-[selected=true]:text-pf-text-primary"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Command.Item>
                )
              })}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-pf-border px-4 py-2">
            <span className="text-xs text-pf-text-muted">
              Naviga con ↑↓ · Seleziona con ↵ · Chiudi con Esc
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-muted transition-colors hover:border-pf-border-hover hover:text-pf-text-secondary"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Cerca...</span>
      <kbd className="hidden rounded border border-pf-border bg-pf-bg-secondary px-1.5 py-0.5 text-[10px] font-medium sm:inline">
        ⌘K
      </kbd>
    </button>
  )
}
