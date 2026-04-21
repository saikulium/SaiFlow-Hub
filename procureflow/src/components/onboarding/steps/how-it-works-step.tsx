'use client'

import { FileText, CheckCircle, ShoppingCart, Package } from 'lucide-react'

const FLOW_STEPS = [
  { icon: FileText, label: 'Richiesta', desc: 'Crea una richiesta di acquisto', color: 'text-blue-400' },
  { icon: CheckCircle, label: 'Approvazione', desc: 'Il manager approva', color: 'text-amber-400' },
  { icon: ShoppingCart, label: 'Ordine', desc: 'Ordine al fornitore', color: 'text-pf-accent' },
  { icon: Package, label: 'Consegna', desc: 'Ricevi e conferma', color: 'text-emerald-400' },
] as const

export function HowItWorksStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-display text-xl font-bold text-pf-text-primary">
        Come Funziona
      </h2>
      <p className="mt-2 text-sm text-pf-text-secondary">
        Ogni richiesta segue questo percorso. Tu puoi seguirla in tempo reale.
      </p>

      <div className="mt-8 flex w-full items-start justify-center gap-2">
        {FLOW_STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-pf-bg-tertiary">
                  <Icon className={`h-7 w-7 ${step.color}`} />
                </div>
                <p className="text-sm font-semibold text-pf-text-primary">{step.label}</p>
                <p className="max-w-[110px] text-xs text-pf-text-muted">{step.desc}</p>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <span className="mx-1 mt-[-28px] text-lg text-pf-text-muted/40">→</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
