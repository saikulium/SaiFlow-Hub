'use client'

import { Plus, Mail, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

const actions = [
  {
    label: 'Nuova Richiesta',
    icon: Plus,
    href: '/requests/new',
    variant: 'primary' as const,
  },
  {
    label: 'Importa da Email',
    icon: Mail,
    href: null,
    variant: 'secondary' as const,
  },
  {
    label: 'Report Settimanale',
    icon: FileText,
    href: null,
    variant: 'secondary' as const,
  },
]

export function QuickActions() {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h2 className="mb-4 font-display text-lg font-semibold text-pf-text-primary">
        Azioni Rapide
      </h2>
      <div className="space-y-3">
        {actions.map((action, i) => {
          const Icon = action.icon
          const content = (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex w-full items-center gap-3 rounded-button px-4 py-3 text-sm font-medium transition-all ${
                action.variant === 'primary'
                  ? 'bg-pf-accent text-white hover:bg-pf-accent-hover'
                  : 'border border-pf-border bg-pf-bg-tertiary text-pf-text-primary hover:border-pf-border-hover hover:bg-pf-bg-hover'
              }`}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </motion.div>
          )

          if (action.href) {
            return (
              <Link key={i} href={action.href}>
                {content}
              </Link>
            )
          }

          return (
            <button
              key={i}
              onClick={() =>
                toast.info('Funzionalità in arrivo', {
                  description: `"${action.label}" sarà disponibile con l'integrazione n8n.`,
                })
              }
              className="w-full text-left"
            >
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}
