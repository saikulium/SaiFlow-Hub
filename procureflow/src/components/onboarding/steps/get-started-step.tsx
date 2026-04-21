'use client'

import { LayoutDashboard, Bell, Search } from 'lucide-react'

const TIPS = [
  {
    icon: LayoutDashboard,
    title: 'Sidebar',
    desc: 'Naviga tra richieste, fornitori e analytics dal menu laterale',
  },
  {
    icon: Bell,
    title: 'Notifiche',
    desc: 'Ricevi aggiornamenti in tempo reale su approvazioni e consegne',
  },
  {
    icon: Search,
    title: 'Ricerca ⌘K',
    desc: 'Cerca qualsiasi cosa rapidamente con la scorciatoia da tastiera',
  },
] as const

export function GetStartedStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-display text-xl font-bold text-pf-text-primary">
        Sei Pronto!
      </h2>
      <p className="mt-2 text-sm text-pf-text-secondary">
        Ecco 3 cose da sapere per iniziare subito
      </p>

      <div className="mt-6 grid w-full gap-3">
        {TIPS.map((tip) => {
          const Icon = tip.icon
          return (
            <div
              key={tip.title}
              className="flex items-center gap-4 rounded-xl border border-pf-border bg-pf-bg-tertiary p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pf-accent-subtle">
                <Icon className="h-5 w-5 text-pf-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-pf-text-primary">{tip.title}</p>
                <p className="text-xs text-pf-text-muted">{tip.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
