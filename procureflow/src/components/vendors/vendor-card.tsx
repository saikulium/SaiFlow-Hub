'use client'

import { memo, useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Star,
  Mail,
  Phone,
  ClipboardList,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VENDOR_STATUS_CONFIG } from '@/lib/constants'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { useDeleteRecord, useIsAdmin } from '@/hooks/use-delete-record'
import type { VendorListItem } from '@/hooks/use-vendors'

interface VendorCardProps {
  vendor: VendorListItem
  index: number
}

function StarRating({ rating }: { rating: number | null }) {
  const value = rating ?? 0
  const stars = Array.from({ length: 5 }, (_, i) => i < value)

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((filled, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            filled
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-pf-text-muted',
          )}
        />
      ))}
    </div>
  )
}

export const VendorCard = memo(function VendorCard({
  vendor,
  index,
}: VendorCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAdmin = useIsAdmin()
  const deleteMutation = useDeleteRecord('vendors')

  const statusConfig = VENDOR_STATUS_CONFIG[vendor.status] ?? {
    label: vendor.status,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }

  const categories = Array.isArray(vendor.category) ? vendor.category : []

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen((p) => !p)
  }, [])

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    setDeleteOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    deleteMutation.mutate(vendor.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }, [vendor.id, deleteMutation])

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.4, ease: 'easeOut' }}
        whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
        className="relative"
      >
        <Link
          href={`/vendors/${vendor.id}`}
          className="hover:border-pf-accent/30 hover:shadow-pf-accent/5 group block rounded-card border border-pf-border bg-pf-bg-secondary p-5 transition-all duration-200 hover:shadow-lg"
        >
          {/* Header: Name + Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-lg font-semibold text-pf-text-primary">
                {vendor.name}
              </h3>
              <p className="mt-0.5 font-mono text-xs text-pf-text-muted">
                {vendor.code}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium',
                  statusConfig.bgColor,
                  statusConfig.color,
                )}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Rating */}
          <div className="mt-3">
            <StarRating rating={vendor.rating} />
          </div>

          {/* Contact info */}
          <div className="mt-3 space-y-1.5">
            {vendor.email && (
              <div className="flex items-center gap-2 text-sm text-pf-text-secondary">
                <Mail className="h-3.5 w-3.5 shrink-0 text-pf-text-muted" />
                <span className="truncate">{vendor.email}</span>
              </div>
            )}
            {vendor.phone && (
              <div className="flex items-center gap-2 text-sm text-pf-text-secondary">
                <Phone className="h-3.5 w-3.5 shrink-0 text-pf-text-muted" />
                <span>{vendor.phone}</span>
              </div>
            )}
          </div>

          {/* Footer: Categories + Request count */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="bg-pf-accent/10 rounded-badge px-2 py-0.5 text-xs font-medium text-pf-accent"
                >
                  {cat}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1 text-xs text-pf-text-muted">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>{vendor._count.requests}</span>
            </div>
          </div>
        </Link>

        {/* Admin actions overlay */}
        {isAdmin && (
          <div className="absolute right-3 top-3" ref={menuRef}>
            <button
              type="button"
              onClick={handleMenuToggle}
              className="bg-pf-bg-secondary/80 rounded-button p-1.5 text-pf-text-muted shadow-sm backdrop-blur-sm transition-all hover:bg-pf-bg-hover hover:text-pf-text-secondary"
              style={{ pointerEvents: 'auto' }}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-card border border-pf-border bg-pf-bg-secondary py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
        title="Elimina fornitore"
        description="Questa azione e irreversibile. Il fornitore verra eliminato solo se non ha richieste associate."
        itemName={`${vendor.code} — ${vendor.name}`}
      />
    </>
  )
})
