// ---------------------------------------------------------------------------
// Configurazione SDI e soglie per matching/riconciliazione fatture
// ---------------------------------------------------------------------------

/** Configurazione provider SDI */
export const SDI_CONFIG = {
  provider: process.env.SDI_PROVIDER ?? 'openapi',
  api_base_url: process.env.SDI_API_BASE_URL ?? 'https://sdi.openapi.it',
  webhook_secret: process.env.SDI_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET,
} as const

/** Soglie per il matching automatico fattura ↔ ordine */
export const MATCHING_THRESHOLDS = {
  /** Confidenza minima per AUTO_MATCHED (sotto → SUGGESTED) */
  AUTO_MATCH_MIN_CONFIDENCE: Number(
    process.env.SDI_AUTO_MATCH_CONFIDENCE ?? 0.8,
  ),
  /** Tolleranza percentuale per match per importo */
  AMOUNT_TOLERANCE_PERCENT: Number(
    process.env.SDI_AMOUNT_TOLERANCE_PERCENT ?? 10,
  ),
  /** Finestra temporale in giorni per match per data */
  SEARCH_WINDOW_DAYS: 90,
} as const

/** Soglie per il three-way matching */
export const RECONCILIATION_THRESHOLDS = {
  /** Sotto questa % → auto-approvazione riconciliazione */
  AUTO_APPROVE_PERCENT: Number(
    process.env.SDI_AUTO_APPROVE_THRESHOLD ?? 2,
  ),
  /** Tra auto_approve e warning → WARNING (conferma richiesta) */
  WARNING_PERCENT: Number(process.env.SDI_WARNING_THRESHOLD ?? 5),
  /** Sopra warning → FAIL, revisione manuale obbligatoria */
} as const

/** Config UI per InvoiceMatchStatus */
export const INVOICE_MATCH_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  UNMATCHED: {
    label: 'Non associata',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  AUTO_MATCHED: {
    label: 'Auto-associata',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  SUGGESTED: {
    label: 'Match suggerito',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  MANUALLY_MATCHED: {
    label: 'Associata manualmente',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  NO_MATCH: {
    label: 'Senza ordine',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
  },
}

/** Config UI per ReconciliationStatus */
export const RECONCILIATION_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: 'Da riconciliare',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  MATCHED: {
    label: 'Associata',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  APPROVED: {
    label: 'Approvata',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  DISPUTED: {
    label: 'Contestata',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  REJECTED: {
    label: 'Rifiutata',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  PAID: {
    label: 'Pagata',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
}
