'use client'

import { motion } from 'framer-motion'
import { Check, X, Ban, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  REQUEST_LIFECYCLE_STEPS,
  LIFECYCLE_STEP_LABELS,
} from '@/lib/constants/approval-thresholds'

interface StatusStepperProps {
  currentStatus: string
}

type SpecialStatus = 'REJECTED' | 'CANCELLED' | 'ON_HOLD'

const SPECIAL_STATUSES: readonly string[] = ['REJECTED', 'CANCELLED', 'ON_HOLD']

function isSpecialStatus(status: string): status is SpecialStatus {
  return SPECIAL_STATUSES.includes(status)
}

function getSpecialIcon(status: SpecialStatus) {
  switch (status) {
    case 'REJECTED':
      return <X className="h-3 w-3" />
    case 'CANCELLED':
      return <Ban className="h-3 w-3" />
    case 'ON_HOLD':
      return <Pause className="h-3 w-3" />
  }
}

function getSpecialColor(status: SpecialStatus): string {
  switch (status) {
    case 'REJECTED':
      return 'bg-red-500 border-red-500'
    case 'CANCELLED':
      return 'bg-zinc-500 border-zinc-500'
    case 'ON_HOLD':
      return 'bg-orange-400 border-orange-400'
  }
}

function getSpecialLineColor(status: SpecialStatus): string {
  switch (status) {
    case 'REJECTED':
      return 'bg-red-500'
    case 'CANCELLED':
      return 'bg-zinc-500'
    case 'ON_HOLD':
      return 'bg-orange-400'
  }
}

export function StatusStepper({ currentStatus }: StatusStepperProps) {
  const special = isSpecialStatus(currentStatus)
  const steps = REQUEST_LIFECYCLE_STEPS

  // Find the index of the current step in the lifecycle
  const currentIndex = special
    ? steps.indexOf(
        currentStatus === 'REJECTED' || currentStatus === 'ON_HOLD'
          ? 'PENDING_APPROVAL'
          : 'APPROVED',
      )
    : steps.indexOf(currentStatus as (typeof steps)[number])

  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex

  // Calculate progress percentage for the animated line
  const progressPercent =
    steps.length > 1 ? (resolvedIndex / (steps.length - 1)) * 100 : 0

  return (
    <div className="w-full">
      {/* Desktop: horizontal layout */}
      <div className="hidden sm:block">
        <div className="relative">
          {/* Background track line */}
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-pf-border" />

          {/* Animated progress line */}
          <motion.div
            className={cn(
              'absolute left-0 top-4 h-0.5',
              special
                ? getSpecialLineColor(currentStatus as SpecialStatus)
                : 'bg-green-500',
            )}
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < resolvedIndex
              const isCurrent = index === resolvedIndex
              const isFuture = index > resolvedIndex

              return (
                <div
                  key={step}
                  className="flex flex-col items-center"
                  style={{ width: `${100 / steps.length}%` }}
                >
                  {/* Circle */}
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    {isCompleted && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-500 bg-green-500 text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}

                    {isCurrent && special && (
                      <div
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full border-2 text-white',
                          getSpecialColor(currentStatus as SpecialStatus),
                        )}
                      >
                        {getSpecialIcon(currentStatus as SpecialStatus)}
                      </div>
                    )}

                    {isCurrent && !special && (
                      <motion.div
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-pf-accent bg-pf-accent"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </motion.div>
                    )}

                    {isFuture && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-pf-border bg-pf-bg-secondary">
                        <div className="h-1.5 w-1.5 rounded-full bg-pf-border" />
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'mt-2 text-center text-[10px] leading-tight',
                      isCompleted && 'font-medium text-green-400',
                      isCurrent &&
                        !special &&
                        'font-semibold text-pf-accent',
                      isCurrent &&
                        special &&
                        currentStatus === 'REJECTED' &&
                        'font-semibold text-red-400',
                      isCurrent &&
                        special &&
                        currentStatus === 'CANCELLED' &&
                        'font-semibold text-zinc-500',
                      isCurrent &&
                        special &&
                        currentStatus === 'ON_HOLD' &&
                        'font-semibold text-orange-400',
                      isFuture && 'text-pf-text-muted',
                    )}
                  >
                    {isCurrent && special
                      ? LIFECYCLE_STEP_LABELS[currentStatus] ?? currentStatus
                      : LIFECYCLE_STEP_LABELS[step] ?? step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile: vertical layout */}
      <div className="block sm:hidden">
        <div className="relative flex flex-col gap-0">
          {steps.map((step, index) => {
            const isCompleted = index < resolvedIndex
            const isCurrent = index === resolvedIndex
            const isFuture = index > resolvedIndex
            const isLast = index === steps.length - 1

            return (
              <div key={step} className="flex items-start gap-3">
                {/* Circle + connecting line */}
                <div className="flex flex-col items-center">
                  <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                    {isCompleted && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-green-500 bg-green-500 text-white">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}

                    {isCurrent && special && (
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border-2 text-white',
                          getSpecialColor(currentStatus as SpecialStatus),
                        )}
                      >
                        {getSpecialIcon(currentStatus as SpecialStatus)}
                      </div>
                    )}

                    {isCurrent && !special && (
                      <motion.div
                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-pf-accent bg-pf-accent"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </motion.div>
                    )}

                    {isFuture && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-pf-border bg-pf-bg-secondary">
                        <div className="h-1 w-1 rounded-full bg-pf-border" />
                      </div>
                    )}
                  </div>

                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      className={cn(
                        'h-6 w-0.5',
                        isCompleted
                          ? 'bg-green-500'
                          : isCurrent && special
                            ? getSpecialLineColor(
                                currentStatus as SpecialStatus,
                              )
                            : 'bg-pf-border',
                      )}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'pt-1 text-xs leading-tight',
                    isCompleted && 'font-medium text-green-400',
                    isCurrent && !special && 'font-semibold text-pf-accent',
                    isCurrent &&
                      special &&
                      currentStatus === 'REJECTED' &&
                      'font-semibold text-red-400',
                    isCurrent &&
                      special &&
                      currentStatus === 'CANCELLED' &&
                      'font-semibold text-zinc-500',
                    isCurrent &&
                      special &&
                      currentStatus === 'ON_HOLD' &&
                      'font-semibold text-orange-400',
                    isFuture && 'text-pf-text-muted',
                  )}
                >
                  {isCurrent && special
                    ? LIFECYCLE_STEP_LABELS[currentStatus] ?? currentStatus
                    : LIFECYCLE_STEP_LABELS[step] ?? step}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
