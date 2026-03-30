'use client'

import { useCallback, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CsvColumn<T> {
  readonly header: string
  readonly accessor: (row: T) => string | number | null | undefined
}

interface ExportCsvButtonProps<T> {
  readonly data: readonly T[]
  readonly columns: readonly CsvColumn<T>[]
  readonly filename: string
  readonly label?: string
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function ExportCsvButton<T>({
  data,
  columns,
  filename,
  label = 'Esporta CSV',
}: ExportCsvButtonProps<T>) {
  const [loading, setLoading] = useState(false)

  const handleExport = useCallback(() => {
    if (data.length === 0) {
      toast.error('Nessun dato da esportare')
      return
    }

    setLoading(true)

    try {
      const headerRow = columns.map((col) => escapeCsvField(col.header)).join(',')

      const dataRows = data.map((row) =>
        columns
          .map((col) => {
            const value = col.accessor(row)
            if (value == null) return ''
            return escapeCsvField(String(value))
          })
          .join(','),
      )

      const csv = [headerRow, ...dataRows].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`${data.length} righe esportate`)
    } catch {
      toast.error('Errore durante l\'esportazione')
    } finally {
      setLoading(false)
    }
  }, [data, columns, filename])

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading || data.length === 0}
      className="inline-flex items-center gap-2 rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label}
    </button>
  )
}
