'use client'

import { useState } from 'react'
import { FileText, Paperclip, Download, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AttachmentUpload } from '../attachment-upload'
import { AttachmentPreview } from '../attachment-preview'
import { useAttachments, type Attachment } from '../../hooks/use-attachments'
import { EmptyState } from './empty-state'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AllegatiTab({ requestId }: { readonly requestId: string }) {
  const { data: attachments, isLoading } = useAttachments(requestId)
  const [preview, setPreview] = useState<Attachment | null>(null)

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <AttachmentUpload requestId={requestId} />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-pf-text-muted" />
        </div>
      )}

      {/* List */}
      {attachments && attachments.length === 0 && (
        <EmptyState
          icon={Paperclip}
          title="Nessun allegato"
          description="Carica un file per aggiungerlo alla richiesta."
        />
      )}

      {attachments && attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-start gap-3 rounded-card border border-pf-border bg-pf-bg-secondary p-4"
            >
              <div className="bg-pf-accent/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-button">
                <FileText className="h-5 w-5 text-pf-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setPreview(attachment)}
                  className="truncate text-sm font-medium text-pf-text-primary transition-colors hover:text-pf-accent"
                >
                  {attachment.filename}
                </button>
                <p className="text-xs text-pf-text-secondary">
                  {attachment.file_size !== null
                    ? formatFileSize(attachment.file_size)
                    : '—'}
                </p>
                <p className="text-xs text-pf-text-secondary">
                  {formatDate(attachment.created_at)}
                </p>
              </div>
              <a
                href={attachment.file_url}
                download={attachment.filename}
                className="hover:bg-pf-bg-elevated shrink-0 rounded-button p-1.5 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                aria-label={`Scarica ${attachment.filename}`}
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <AttachmentPreview
          isOpen={true}
          onClose={() => setPreview(null)}
          fileUrl={preview.file_url}
          filename={preview.filename}
          mimeType={preview.mime_type}
        />
      )}
    </div>
  )
}
