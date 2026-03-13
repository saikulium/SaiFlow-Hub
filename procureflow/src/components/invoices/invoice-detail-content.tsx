'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  List,
  ShoppingCart,
  CheckCheck,
  Clock,
  Loader2,
} from 'lucide-react'
import { useInvoice, type InvoiceDetail } from '@/hooks/use-invoice'
import { InvoiceStatusBadge } from './invoice-status-badge'
import { DettagliTab } from './tabs/dettagli-tab'
import { RigheTab } from './tabs/righe-tab'
import { OrdineTab } from './tabs/ordine-tab'
import { RiconciliazioneTab } from './tabs/riconciliazione-tab'
import { TimelineTab } from './tabs/timeline-tab'
import { cn } from '@/lib/utils'

// --- Types ---

type TabKey = 'dettagli' | 'righe' | 'ordine' | 'riconciliazione' | 'timeline'

interface TabDef {
  readonly key: TabKey
  readonly label: string
  readonly icon: React.ElementType
}

const TABS: readonly TabDef[] = [
  { key: 'dettagli', label: 'Dettagli', icon: FileText },
  { key: 'righe', label: 'Righe', icon: List },
  { key: 'ordine', label: 'Ordine', icon: ShoppingCart },
  { key: 'riconciliazione', label: 'Riconciliazione', icon: CheckCheck },
  { key: 'timeline', label: 'Timeline', icon: Clock },
] as const

// --- Skeleton ---

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 rounded bg-pf-bg-tertiary" />
        <div className="h-8 w-64 rounded bg-pf-bg-tertiary" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-24 rounded bg-pf-bg-tertiary" />
        <div className="h-6 w-24 rounded bg-pf-bg-tertiary" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded bg-pf-bg-tertiary" />
        ))}
      </div>
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-pf-bg-tertiary" />
              <div className="h-5 w-32 rounded bg-pf-bg-tertiary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Back Link ---

function BackLink() {
  return (
    <Link
      href="/invoices"
      className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary transition-colors hover:text-pf-text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      Torna alle fatture
    </Link>
  )
}

// --- Tab Content ---

function TabContent({
  activeTab,
  invoice,
}: {
  activeTab: TabKey
  invoice: InvoiceDetail
}) {
  switch (activeTab) {
    case 'dettagli':
      return <DettagliTab invoice={invoice} />
    case 'righe':
      return <RigheTab lineItems={invoice.line_items} />
    case 'ordine':
      return <OrdineTab invoice={invoice} />
    case 'riconciliazione':
      return <RiconciliazioneTab invoice={invoice} />
    case 'timeline':
      return <TimelineTab events={invoice.timeline_events} />
  }
}

// --- Main Component ---

interface InvoiceDetailContentProps {
  invoiceId: string
}

export function InvoiceDetailContent({
  invoiceId,
}: InvoiceDetailContentProps) {
  const { data, isLoading, error } = useInvoice(invoiceId)
  const [activeTab, setActiveTab] = useState<TabKey>('dettagli')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <DetailSkeleton />
      </div>
    )
  }

  if (error || !data?.success || !data.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-red-400">
            {error instanceof Error
              ? error.message
              : 'Errore nel caricamento della fattura'}
          </p>
          <Link
            href="/invoices"
            className="mt-4 text-sm text-pf-accent hover:underline"
          >
            Torna alle fatture
          </Link>
        </div>
      </div>
    )
  }

  const invoice = data.data

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-pf-text-primary">
          {invoice.invoice_number}
        </h1>
        <p className="text-sm text-pf-text-secondary">
          {invoice.supplier_name}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <InvoiceStatusBadge type="match" status={invoice.match_status} />
          <InvoiceStatusBadge
            type="reconciliation"
            status={invoice.reconciliation_status}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-pf-border">
        <nav className="-mb-px flex gap-6" aria-label="Sezioni fattura">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-pf-accent text-pf-accent'
                    : 'border-transparent text-pf-text-secondary hover:text-pf-text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <TabContent activeTab={activeTab} invoice={invoice} />
    </div>
  )
}
