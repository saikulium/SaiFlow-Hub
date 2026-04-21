'use client'

import { Trash2 } from 'lucide-react'

interface DeleteRowButtonProps {
  readonly onDelete: () => void
  readonly title?: string
}

export function DeleteRowButton({
  onDelete,
  title = 'Elimina',
}: DeleteRowButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onDelete()
      }}
      className="rounded-button p-1 text-pf-text-muted transition-all hover:bg-red-500/10 hover:text-red-400"
      title={title}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
