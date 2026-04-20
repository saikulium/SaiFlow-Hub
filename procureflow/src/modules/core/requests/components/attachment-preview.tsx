'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, FileText, Image as ImageIcon } from 'lucide-react'

interface AttachmentPreviewProps {
  isOpen: boolean
  onClose: () => void
  fileUrl: string
  filename: string
  mimeType: string | null
}

export function AttachmentPreview({
  isOpen,
  onClose,
  fileUrl,
  filename,
  mimeType,
}: AttachmentPreviewProps) {
  const isImage = mimeType?.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-pf-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {isImage ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-pf-text-muted" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-pf-text-muted" />
                )}
                <span className="truncate text-sm font-medium text-pf-text-primary">
                  {filename}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={fileUrl}
                  download={filename}
                  className="hover:bg-pf-bg-elevated inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                >
                  <Download className="h-3.5 w-3.5" />
                  Scarica
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="hover:bg-pf-bg-elevated flex h-8 w-8 items-center justify-center rounded-button text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {isImage && (
                <img
                  src={fileUrl}
                  alt={filename}
                  className="mx-auto max-h-[70vh] rounded object-contain"
                />
              )}
              {isPdf && (
                <iframe
                  src={fileUrl}
                  title={filename}
                  className="h-[70vh] w-full rounded border-0"
                />
              )}
              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-16 w-16 text-pf-text-muted" />
                  <p className="mt-4 text-sm font-medium text-pf-text-primary">
                    Anteprima non disponibile
                  </p>
                  <p className="mt-1 text-xs text-pf-text-secondary">
                    Scarica il file per visualizzarlo
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
