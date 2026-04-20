// ---------------------------------------------------------------------------
// Email configuration
//
// Carica configurazione email da env. Usato da ResendTransport e template
// renderer (per link assoluti nelle email).
// ---------------------------------------------------------------------------

export const EMAIL_CONFIG = {
  /** Mittente (es. "ProcureFlow <notifications@mail.kairoflows.com>") */
  from:
    process.env.EMAIL_FROM ??
    'ProcureFlow <notifications@mail.kairoflows.com>',
  /** Reply-To opzionale */
  replyTo: process.env.EMAIL_REPLY_TO,
  /** Base URL dell'app — usato per costruire link assoluti nelle email */
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
} as const

export type EmailConfig = typeof EMAIL_CONFIG
