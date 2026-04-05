'use client'

import { useCallback, useState } from 'react'
import { Plus, Mail, FileText, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import { EmailImportDialog } from '@/components/dashboard/email-import-dialog'

export function QuickActions() {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const handleDownloadReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const res = await fetch('/api/reports/weekly')

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error?.message ?? 'Errore generazione report')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ??
        'report-settimanale.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Report scaricato')
    } catch {
      toast.error('Errore di rete')
    } finally {
      setReportLoading(false)
    }
  }, [])

  return (
    <>
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-pf-text-primary">
          Azioni Rapide
        </h2>
        <div className="space-y-3">
          {/* Nuova Richiesta */}
          <Link href="/requests/new">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center gap-3 rounded-button bg-pf-accent px-4 py-3 text-sm font-medium text-white transition-all hover:bg-pf-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Nuova Richiesta
            </motion.div>
          </Link>

          {/* Importa da Email */}
          <button
            onClick={() => setEmailDialogOpen(true)}
            className="w-full text-left"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center gap-3 rounded-button border border-pf-border bg-pf-bg-tertiary px-4 py-3 text-sm font-medium text-pf-text-primary transition-all hover:border-pf-border-hover hover:bg-pf-bg-hover"
            >
              <Mail className="h-4 w-4" />
              Importa da Email
            </motion.div>
          </button>

          {/* Report Settimanale */}
          <button
            onClick={handleDownloadReport}
            disabled={reportLoading}
            className="w-full text-left"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center gap-3 rounded-button border border-pf-border bg-pf-bg-tertiary px-4 py-3 text-sm font-medium text-pf-text-primary transition-all hover:border-pf-border-hover hover:bg-pf-bg-hover disabled:opacity-60"
            >
              {reportLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {reportLoading ? 'Generazione...' : 'Report Settimanale'}
            </motion.div>
          </button>
        </div>
      </div>

      <EmailImportDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
      />
    </>
  )
}
