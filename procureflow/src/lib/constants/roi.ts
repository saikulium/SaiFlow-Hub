/** Industry benchmarks for manual procurement (Italian SMEs) */
export const DEFAULT_ROI_BENCHMARKS = {
  manualCycleTimeDays: 14,
  manualApprovalTimeHours: 48,
  manualHoursPerRequest: 2,
  platformHoursPerRequest: 0.5,
  hourlyLaborCost: 35,
  manualAutoMatchRate: 0,
  manualOnTimeDeliveryRate: 65,
  // Automazione
  manualMinutesPerEmail: 7,
  manualMinutesPerInvoice: 15,
  platformMinutesPerInvoice: 2,
  manualMinutesPerReconciliation: 12,
  platformMinutesPerReconciliation: 3,
  manualMinutesPerApproval: 30,
  autoApprovalThresholdSeconds: 60,
} as const

export type RoiBenchmarks = typeof DEFAULT_ROI_BENCHMARKS

export const ROI_PERIOD_OPTIONS = [
  { value: '30d', label: 'Ultimi 30 giorni' },
  { value: '90d', label: 'Ultimi 90 giorni' },
  { value: '6m', label: 'Ultimi 6 mesi' },
  { value: '12m', label: 'Ultimi 12 mesi' },
  { value: 'all', label: 'Tutto il periodo' },
] as const
