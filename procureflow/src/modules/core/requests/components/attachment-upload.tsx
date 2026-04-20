'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, AlertCircle } from 'lucide-react'
import { useUploadAttachment } from '../hooks/use-attachments'
import {
  validateAttachment,
  ALLOWED_EXTENSIONS_LABEL,
} from '../validations/attachment'
import { cn } from '@/lib/utils'

interface AttachmentUploadProps {
  requestId: string
}

export function AttachmentUpload({ requestId }: AttachmentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutateAsync, isPending } = useUploadAttachment(requestId)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setError(null)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        const validation = validateAttachment(file)
        if (!validation.valid) {
          setError(validation.error)
          return
        }

        try {
          await mutateAsync(file)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Errore nell'upload")
          return
        }
      }
    },
    [mutateAsync],
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed p-8 transition-colors',
          isDragOver
            ? 'bg-pf-accent/5 border-pf-accent'
            : 'border-pf-border hover:border-pf-border-hover hover:bg-pf-bg-secondary',
          isPending && 'pointer-events-none opacity-50',
        )}
      >
        {isPending ? (
          <Loader2 className="h-8 w-8 animate-spin text-pf-accent" />
        ) : (
          <Upload
            className={cn(
              'h-8 w-8',
              isDragOver ? 'text-pf-accent' : 'text-pf-text-muted',
            )}
          />
        )}
        <p className="mt-2 text-sm font-medium text-pf-text-secondary">
          {isPending
            ? 'Caricamento in corso...'
            : 'Trascina file o clicca per caricare'}
        </p>
        <p className="mt-1 text-xs text-pf-text-muted">
          {ALLOWED_EXTENSIONS_LABEL} — Max 10 MB
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-button bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  )
}
