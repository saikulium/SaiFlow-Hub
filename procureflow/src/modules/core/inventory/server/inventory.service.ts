// ---------------------------------------------------------------------------
// Pure functions — no side effects, no DB imports
// ---------------------------------------------------------------------------

/**
 * Generates a material code in the format MAT-{prefix}-{NNNNN}.
 */
export function generateMaterialCode(
  prefix: string,
  sequenceNumber: number,
): string {
  const paddedSeq = String(sequenceNumber).padStart(5, '0')
  return `MAT-${prefix}-${paddedSeq}`
}

/**
 * Generates a lot number in the format LOT-{YYYY}-{NNNNN}.
 */
export function generateLotNumber(
  year: number,
  sequenceNumber: number,
): string {
  const paddedSeq = String(sequenceNumber).padStart(5, '0')
  return `LOT-${year}-${paddedSeq}`
}

/**
 * Generates a movement code in the format MOV-{YYYY}-{NNNNN}.
 */
export function generateMovementCode(
  year: number,
  sequenceNumber: number,
): string {
  const paddedSeq = String(sequenceNumber).padStart(5, '0')
  return `MOV-${year}-${paddedSeq}`
}

/**
 * Generates an inventory code in the format INV-{YYYY}-{NNNNN}.
 */
export function generateInventoryCode(
  year: number,
  sequenceNumber: number,
): string {
  const paddedSeq = String(sequenceNumber).padStart(5, '0')
  return `INV-${year}-${paddedSeq}`
}

/**
 * Computes the weighted average cost after a new stock load.
 *
 * Formula: (currentStock * currentCost + newQuantity * newCost) / (currentStock + newQuantity)
 * Returns 0 when both currentStock and newQuantity are 0 (avoids division by zero).
 * Rounds to 4 decimal places.
 */
export function computeWeightedAverageCost(
  currentStock: number,
  currentCost: number,
  newQuantity: number,
  newCost: number,
): number {
  const totalQuantity = currentStock + newQuantity

  if (totalQuantity === 0) {
    return 0
  }

  const totalValue = currentStock * currentCost + newQuantity * newCost
  const average = totalValue / totalQuantity

  return Math.round(average * 10000) / 10000
}

export type StockStatus = 'OK' | 'LOW' | 'OUT'

export interface StockLevel {
  readonly physical: number
  readonly available: number
  readonly reserved: number
  readonly status: StockStatus
}

/**
 * Computes current stock level and status.
 *
 * - available = physical - reserved
 * - status: OUT if physical <= 0, LOW if physical <= minLevel, else OK
 */
export function computeStockLevel(
  physical: number,
  reserved: number,
  minLevel: number | null,
): StockLevel {
  const available = physical - reserved

  const status: StockStatus =
    physical <= 0
      ? 'OUT'
      : minLevel !== null && physical <= minLevel
        ? 'LOW'
        : 'OK'

  return { physical, available, reserved, status }
}

export interface MovementValidationInput {
  readonly movement_type: string
  readonly reason: string
  readonly lot_id?: string
  readonly to_warehouse_id?: string
}

export interface MovementValidationResult {
  readonly valid: boolean
  readonly reason?: string
}

/**
 * Validates a stock movement based on its type and required fields.
 *
 * - OUTBOUND requires lot_id
 * - TRANSFER requires to_warehouse_id
 * - INBOUND and ADJUSTMENT have no special requirements
 */
export function validateMovement(
  input: MovementValidationInput,
): MovementValidationResult {
  if (input.movement_type === 'OUTBOUND' && !input.lot_id) {
    return {
      valid: false,
      reason: 'Per uno scarico è necessario specificare il lotto',
    }
  }

  if (input.movement_type === 'TRANSFER' && !input.to_warehouse_id) {
    return {
      valid: false,
      reason: 'Per un trasferimento è necessario specificare il magazzino di destinazione',
    }
  }

  return { valid: true }
}
