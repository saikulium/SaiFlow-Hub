'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  CreditCard,
  Star,
  Pencil,
  User,
  StickyNote,
  Building2,
} from 'lucide-react'
import { useVendor } from '@/hooks/use-vendors'
import { VendorEditDialog } from '@/components/vendors/vendor-edit-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { VENDOR_STATUS_CONFIG } from '@/lib/constants'
import type { RequestStatusKey, PriorityKey } from '@/lib/constants'
import {
  cn,
  formatCurrency,
  formatRelativeTime,
  getInitials,
} from '@/lib/utils'

interface VendorDetailContentProps {
  vendorId: string
}

function StarRating({ rating }: { rating: number | null }) {
  const value = rating ?? 0
  const stars = Array.from({ length: 5 }, (_, i) => i < value)

  return (
    <div className="flex items-center gap-1">
      {stars.map((filled, i) => (
        <Star
          key={i}
          className={cn(
            'h-5 w-5',
            filled
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-pf-text-muted',
          )}
        />
      ))}
      {value > 0 && (
        <span className="ml-1.5 text-sm text-pf-text-secondary">{value}/5</span>
      )}
    </div>
  )
}

interface InfoItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  href?: string
}

function InfoItem({ icon: Icon, label, value, href }: InfoItemProps) {
  if (!value) return null

  const content = (
    <div className="flex items-start gap-3 rounded-button p-3 transition-colors hover:bg-pf-bg-hover">
      <div className="bg-pf-accent/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-button">
        <Icon className="h-4 w-4 text-pf-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-pf-text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm text-pf-text-primary">{value}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  return content
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-pf-border" />
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="space-y-4">
          <div className="h-7 w-64 animate-pulse rounded bg-pf-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-pf-border" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-button bg-pf-border"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-pf-border" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-pf-border" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function VendorDetailContent({ vendorId }: VendorDetailContentProps) {
  const { data: vendor, isLoading, error } = useVendor(vendorId)
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (error || !vendor) {
    return (
      <div className="space-y-4">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary transition-colors hover:text-pf-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna ai Fornitori
        </Link>
        <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Errore nel caricamento del fornitore. Verifica che il fornitore
          esista.
        </div>
      </div>
    )
  }

  const statusConfig = VENDOR_STATUS_CONFIG[vendor.status] ?? {
    label: vendor.status,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }

  const categories = Array.isArray(vendor.category) ? vendor.category : []

  return (
    <div className="space-y-6">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          href="/vendors"
          className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary transition-colors hover:text-pf-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna ai Fornitori
        </Link>
      </motion.div>

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-pf-accent/10 flex h-14 w-14 shrink-0 items-center justify-center rounded-card font-display text-lg font-bold text-pf-accent">
              {getInitials(vendor.name)}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-pf-text-primary">
                {vendor.name}
              </h1>
              <p className="mt-0.5 font-mono text-sm text-pf-text-muted">
                {vendor.code}
              </p>
              <div className="mt-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-badge px-2.5 py-0.5 text-xs font-medium',
                    statusConfig.bgColor,
                    statusConfig.color,
                  )}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 rounded-button border border-pf-border bg-pf-bg-secondary px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-border-hover hover:text-pf-text-primary"
          >
            <Pencil className="h-4 w-4" />
            Modifica
          </button>
        </div>

        {/* Rating */}
        <div className="mt-4">
          <StarRating rating={vendor.rating} />
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="bg-pf-accent/10 rounded-badge px-2.5 py-0.5 text-xs font-medium text-pf-accent"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Info grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
      >
        <h2 className="font-display text-base font-semibold text-pf-text-primary">
          Informazioni di Contatto
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <InfoItem
            icon={Mail}
            label="Email"
            value={vendor.email}
            href={vendor.email ? `mailto:${vendor.email}` : undefined}
          />
          <InfoItem
            icon={Phone}
            label="Telefono"
            value={vendor.phone}
            href={vendor.phone ? `tel:${vendor.phone}` : undefined}
          />
          <InfoItem
            icon={Globe}
            label="Sito Web"
            value={vendor.website}
            href={vendor.website ?? undefined}
          />
          <InfoItem
            icon={ExternalLink}
            label={`Portale ${vendor.portal_type ?? 'Fornitore'}`}
            value={vendor.portal_url}
            href={vendor.portal_url ?? undefined}
          />
          <InfoItem
            icon={CreditCard}
            label="Termini di Pagamento"
            value={vendor.payment_terms}
          />
        </div>
      </motion.div>

      {/* Notes */}
      {vendor.notes && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
        >
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-pf-text-muted" />
            <h2 className="font-display text-base font-semibold text-pf-text-primary">
              Note
            </h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-pf-text-secondary">
            {vendor.notes}
          </p>
        </motion.div>
      )}

      {/* Contacts */}
      {vendor.contacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-pf-text-muted" />
            <h2 className="font-display text-base font-semibold text-pf-text-primary">
              Contatti ({vendor.contacts.length})
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {vendor.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 rounded-button border border-pf-border p-3"
              >
                <div className="bg-pf-accent/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-pf-accent">
                  {getInitials(contact.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pf-text-primary">
                    {contact.name}
                  </p>
                  {contact.role && (
                    <p className="text-xs text-pf-text-muted">{contact.role}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-pf-text-secondary">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1 transition-colors hover:text-pf-accent"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-1 transition-colors hover:text-pf-accent"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{contact.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-pf-text-muted" />
            <h2 className="font-display text-base font-semibold text-pf-text-primary">
              Richieste Recenti ({vendor._count.requests})
            </h2>
          </div>
        </div>

        {vendor.requests.length === 0 ? (
          <p className="mt-4 text-sm text-pf-text-muted">
            Nessuna richiesta associata a questo fornitore.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border text-left text-xs text-pf-text-muted">
                  <th className="pb-2 pr-4 font-medium">Codice</th>
                  <th className="pb-2 pr-4 font-medium">Titolo</th>
                  <th className="pb-2 pr-4 font-medium">Stato</th>
                  <th className="pb-2 pr-4 font-medium">Priorita</th>
                  <th className="pb-2 pr-4 text-right font-medium">Importo</th>
                  <th className="pb-2 text-right font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {vendor.requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-pf-border/50 border-b last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/requests/${request.id}`}
                        className="font-mono text-xs text-pf-accent transition-colors hover:text-pf-accent-hover"
                      >
                        {request.code}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate py-3 pr-4 text-pf-text-primary">
                      {request.title}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        status={request.status as RequestStatusKey}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <PriorityBadge
                        priority={request.priority as PriorityKey}
                      />
                    </td>
                    <td className="py-3 pr-4 text-right text-pf-text-secondary">
                      {request.estimated_amount !== null
                        ? formatCurrency(request.estimated_amount)
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap py-3 text-right text-xs text-pf-text-muted">
                      {formatRelativeTime(request.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Edit Dialog */}
      <VendorEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={vendor}
      />
    </div>
  )
}
