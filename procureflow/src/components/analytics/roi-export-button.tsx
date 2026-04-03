'use client'

import { Download } from 'lucide-react'
import type { RoiMetrics } from '@/types'

interface RoiExportButtonProps {
  readonly metrics: RoiMetrics
}

function metricsToCSV(m: RoiMetrics): string {
  const rows: string[][] = [
    ['Metrica', 'Valore', 'Unità'],
    ['Periodo', `${m.periodStart} - ${m.periodEnd}`, ''],
    [''],
    ['--- Risparmio Tempo ---', '', ''],
    ['Ciclo medio', String(m.timeSavings.avgCycleTimeDays), 'giorni'],
    ['Approvazione media', String(m.timeSavings.avgApprovalTimeHours), 'ore'],
    [''],
    ['--- Risparmio Economico ---', '', ''],
    ['Stimato totale', String(m.costSavings.totalEstimated), 'EUR'],
    ['Effettivo totale', String(m.costSavings.totalActual), 'EUR'],
    ['Savings negoziazione', String(m.costSavings.negotiationSavings), 'EUR'],
    [
      'Discrepanze intercettate',
      String(m.costSavings.discrepanciesCaught),
      'EUR',
    ],
    [
      'Discrepanze (conteggio)',
      String(m.costSavings.discrepanciesCaughtCount),
      '',
    ],
    ['Compliance budget', String(m.costSavings.budgetComplianceRate), '%'],
    [''],
    ['--- Efficienza ---', '', ''],
    ['Richieste/mese', String(m.efficiency.requestsPerMonth), ''],
    ['Auto-match fatture', String(m.efficiency.autoMatchRate), '%'],
    ['Consegne puntuali', String(m.efficiency.onTimeDeliveryRate), '%'],
    ['Totale richieste', String(m.efficiency.totalRequests), ''],
    ['Totale consegnate', String(m.efficiency.totalDelivered), ''],
    ['Totale fatture', String(m.efficiency.totalInvoices), ''],
    [''],
    ['--- ROI Summary ---', '', ''],
    [
      'Ore risparmiate (richieste)',
      String(m.summary.estimatedHoursSaved),
      'ore',
    ],
    [
      'Ore risparmiate (automazione)',
      String(m.summary.automationTimeSavedHours),
      'ore',
    ],
    ['Ore risparmiate (totale)', String(m.summary.totalTimeSavedHours), 'ore'],
    ['Valore ore', String(m.summary.hoursSavedValue), 'EUR'],
    ['Risparmio economico', String(m.summary.moneySaved), 'EUR'],
    ['Proiezione annuale', String(m.summary.projectedAnnualSavings), 'EUR'],
    ['Ore annuali stimate', String(m.summary.projectedAnnualHoursSaved), 'ore'],
    [''],
    ['--- Automazione ---', '', ''],
    ['Email processate', String(m.automation.emailsIngested), ''],
    ['Ore risparmiate email', String(m.automation.emailTimeSavedHours), 'ore'],
    ['Fatture processate', String(m.automation.invoicesProcessed), ''],
    ['Fatture SDI', String(m.automation.invoicesSdi), ''],
    ['Fatture OCR', String(m.automation.invoicesOcr), ''],
    [
      'Tempo medio processamento fattura',
      String(m.automation.avgInvoiceProcessingHours),
      'ore',
    ],
    [
      'Ore risparmiate fatture',
      String(m.automation.invoiceTimeSavedHours),
      'ore',
    ],
    ['Fatture riconciliate', String(m.automation.reconciled), ''],
    ['Auto-riconciliate', String(m.automation.reconciledAuto), ''],
    [
      'Tasso auto-riconciliazione',
      String(m.automation.autoReconciliationRate),
      '%',
    ],
    [
      'Ore risparmiate riconciliazione',
      String(m.automation.reconciliationTimeSavedHours),
      'ore',
    ],
    ['Auto-approvate', String(m.automation.autoApprovedCount), ''],
    ['Tasso auto-approvazione', String(m.automation.autoApprovalRate), '%'],
    [
      'Ore risparmiate auto-approvazione',
      String(m.automation.autoApprovalTimeSavedHours),
      'ore',
    ],
    ['Budget monitorati', String(m.automation.activeBudgets), ''],
  ]

  return rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function RoiExportButton({ metrics }: RoiExportButtonProps) {
  function handleExport() {
    const csv = metricsToCSV(metrics)
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(csv, `roi-report-${date}.csv`, 'text/csv;charset=utf-8')
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
    >
      <Download className="h-4 w-4" />
      Esporta CSV
    </button>
  )
}
