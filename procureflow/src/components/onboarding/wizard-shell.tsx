'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface WizardShellProps {
  readonly currentStep: number
  readonly totalSteps: number
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onSkip: () => void
  readonly nextLabel?: string
  readonly showBack?: boolean
  readonly showSkip?: boolean
  readonly optionalFrom?: number
  readonly children: React.ReactNode
}

export function WizardShell({
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Avanti',
  showBack = true,
  showSkip = true,
  optionalFrom,
  children,
}: WizardShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-pf-border bg-pf-bg-secondary shadow-2xl"
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 border-b border-pf-border px-6 py-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-pf-accent'
                    : i < currentStep
                      ? 'bg-pf-accent/50'
                      : 'bg-pf-text-muted/30'
                }`}
              />
              {optionalFrom !== undefined && i >= optionalFrom && (
                <span className="text-[10px] text-pf-text-muted">opz.</span>
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-pf-border px-6 py-4">
          <div>
            {showSkip && (
              <button
                onClick={onSkip}
                className="text-sm text-pf-text-muted transition-colors hover:text-pf-text-secondary"
              >
                Salta
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showBack && currentStep > 0 && (
              <button
                onClick={onBack}
                className="rounded-lg border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover"
              >
                Indietro
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-lg bg-pf-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
