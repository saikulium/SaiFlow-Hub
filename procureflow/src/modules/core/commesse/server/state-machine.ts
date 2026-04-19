import type { CommessaStatus } from '@prisma/client'

export const VALID_COMMESSA_TRANSITIONS: Readonly<
  Record<CommessaStatus, readonly CommessaStatus[]>
> = {
  DRAFT: ['PLANNING', 'CANCELLED'],
  PLANNING: ['ACTIVE', 'ON_HOLD', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['PLANNING', 'ACTIVE'],
  COMPLETED: [],
  CANCELLED: [],
} as const

export function canCommessaTransition(
  from: CommessaStatus,
  to: CommessaStatus,
): boolean {
  const allowed = VALID_COMMESSA_TRANSITIONS[from]
  return allowed.includes(to)
}

export function assertCommessaTransition(
  from: CommessaStatus,
  to: CommessaStatus,
): void {
  if (!canCommessaTransition(from, to)) {
    throw new CommessaTransitionError(
      `Transizione commessa non valida: ${from} → ${to}`,
      from,
      to,
    )
  }
}

export class CommessaTransitionError extends Error {
  readonly from: CommessaStatus
  readonly to: CommessaStatus
  constructor(message: string, from: CommessaStatus, to: CommessaStatus) {
    super(message)
    this.name = 'CommessaTransitionError'
    this.from = from
    this.to = to
  }
}
