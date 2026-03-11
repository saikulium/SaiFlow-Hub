import type { RequestStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// State machine per le transizioni di stato delle richieste d'acquisto.
//
// Ogni stato ha un insieme definito di stati successivi validi.
// Le transizioni non presenti nella mappa sono rifiutate.
// ---------------------------------------------------------------------------

/** Mappa delle transizioni valide: stato corrente -> stati raggiungibili */
export const VALID_TRANSITIONS: Readonly<
  Record<RequestStatus, readonly RequestStatus[]>
> = {
  DRAFT: ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
  SUBMITTED: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'ON_HOLD'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  REJECTED: ['DRAFT'],
  ORDERED: ['SHIPPED', 'CANCELLED', 'ON_HOLD'],
  SHIPPED: ['DELIVERED', 'ON_HOLD'],
  DELIVERED: [],
  CANCELLED: ['DRAFT'],
  ON_HOLD: ['PENDING_APPROVAL', 'ORDERED', 'SHIPPED'],
} as const

/**
 * Verifica se una transizione di stato è valida.
 */
export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  const allowed = VALID_TRANSITIONS[from]
  return allowed.includes(to)
}

/**
 * Asserisce che una transizione è valida. Lancia un errore descrittivo se non lo è.
 */
export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from]
    const allowedStr =
      allowed.length > 0 ? allowed.join(', ') : 'nessuno (stato terminale)'
    throw new TransitionError(
      `Transizione di stato non valida: ${from} -> ${to}. Transizioni consentite da ${from}: ${allowedStr}`,
      from,
      to,
    )
  }
}

/** Errore specifico per transizioni non valide */
export class TransitionError extends Error {
  readonly from: RequestStatus
  readonly to: RequestStatus

  constructor(message: string, from: RequestStatus, to: RequestStatus) {
    super(message)
    this.name = 'TransitionError'
    this.from = from
    this.to = to
  }
}
