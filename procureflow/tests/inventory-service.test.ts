import { describe, it, expect } from 'vitest'
import {
  generateMaterialCode,
  generateLotNumber,
  generateMovementCode,
  generateInventoryCode,
  computeWeightedAverageCost,
  computeStockLevel,
  validateMovement,
} from '@/modules/core/inventory'

// ---------------------------------------------------------------------------
// generateMaterialCode
// ---------------------------------------------------------------------------
describe('generateMaterialCode', () => {
  it('prefix CAV, seq 1 → "MAT-CAV-00001"', () => {
    expect(generateMaterialCode('CAV', 1)).toBe('MAT-CAV-00001')
  })

  it('prefix CAV, seq 42 → "MAT-CAV-00042"', () => {
    expect(generateMaterialCode('CAV', 42)).toBe('MAT-CAV-00042')
  })

  it('prefix CAV, seq 99999 → "MAT-CAV-99999"', () => {
    expect(generateMaterialCode('CAV', 99999)).toBe('MAT-CAV-99999')
  })

  it('different prefix: ELE, seq 7 → "MAT-ELE-00007"', () => {
    expect(generateMaterialCode('ELE', 7)).toBe('MAT-ELE-00007')
  })

  it('seq 100000 overflows to 6 digits gracefully', () => {
    expect(generateMaterialCode('CAV', 100000)).toBe('MAT-CAV-100000')
  })
})

// ---------------------------------------------------------------------------
// generateLotNumber
// ---------------------------------------------------------------------------
describe('generateLotNumber', () => {
  it('year 2026, seq 1 → "LOT-2026-00001"', () => {
    expect(generateLotNumber(2026, 1)).toBe('LOT-2026-00001')
  })

  it('pads to 5 digits: seq 42 → "LOT-2026-00042"', () => {
    expect(generateLotNumber(2026, 42)).toBe('LOT-2026-00042')
  })

  it('max 5 digits: seq 99999 → "LOT-2026-99999"', () => {
    expect(generateLotNumber(2026, 99999)).toBe('LOT-2026-99999')
  })

  it('different year: 2025, seq 500 → "LOT-2025-00500"', () => {
    expect(generateLotNumber(2025, 500)).toBe('LOT-2025-00500')
  })
})

// ---------------------------------------------------------------------------
// generateMovementCode
// ---------------------------------------------------------------------------
describe('generateMovementCode', () => {
  it('year 2026, seq 1 → "MOV-2026-00001"', () => {
    expect(generateMovementCode(2026, 1)).toBe('MOV-2026-00001')
  })

  it('pads to 5 digits: seq 42 → "MOV-2026-00042"', () => {
    expect(generateMovementCode(2026, 42)).toBe('MOV-2026-00042')
  })

  it('max 5 digits: seq 99999 → "MOV-2026-99999"', () => {
    expect(generateMovementCode(2026, 99999)).toBe('MOV-2026-99999')
  })

  it('different year: 2025, seq 123 → "MOV-2025-00123"', () => {
    expect(generateMovementCode(2025, 123)).toBe('MOV-2025-00123')
  })
})

// ---------------------------------------------------------------------------
// generateInventoryCode
// ---------------------------------------------------------------------------
describe('generateInventoryCode', () => {
  it('year 2026, seq 1 → "INV-2026-00001"', () => {
    expect(generateInventoryCode(2026, 1)).toBe('INV-2026-00001')
  })

  it('pads to 5 digits: seq 42 → "INV-2026-00042"', () => {
    expect(generateInventoryCode(2026, 42)).toBe('INV-2026-00042')
  })

  it('max 5 digits: seq 99999 → "INV-2026-99999"', () => {
    expect(generateInventoryCode(2026, 99999)).toBe('INV-2026-99999')
  })

  it('different year: 2025, seq 7 → "INV-2025-00007"', () => {
    expect(generateInventoryCode(2025, 7)).toBe('INV-2025-00007')
  })
})

// ---------------------------------------------------------------------------
// computeWeightedAverageCost
// ---------------------------------------------------------------------------
describe('computeWeightedAverageCost', () => {
  it('standard case: stock=1000, cost=0.50, new=500, newCost=0.60 → 0.5333', () => {
    const result = computeWeightedAverageCost(1000, 0.5, 500, 0.6)
    expect(result).toBeCloseTo(0.5333, 4)
  })

  it('first load (currentStock=0): result equals newCost', () => {
    const result = computeWeightedAverageCost(0, 0, 500, 0.6)
    expect(result).toBe(0.6)
  })

  it('both zero (currentStock=0 AND newQuantity=0): result is 0', () => {
    const result = computeWeightedAverageCost(0, 0, 0, 0)
    expect(result).toBe(0)
  })

  it('multiple loads maintain precision', () => {
    // First load: 100 units at 10.00
    const cost1 = computeWeightedAverageCost(0, 0, 100, 10.0)
    expect(cost1).toBe(10.0)

    // Second load: 200 units at 12.50
    const cost2 = computeWeightedAverageCost(100, cost1, 200, 12.5)
    // (100 * 10.0 + 200 * 12.5) / 300 = (1000 + 2500) / 300 = 11.6667
    expect(cost2).toBeCloseTo(11.6667, 4)
  })

  it('equal quantities and costs', () => {
    const result = computeWeightedAverageCost(100, 5.0, 100, 5.0)
    expect(result).toBe(5.0)
  })

  it('rounds to 4 decimal places', () => {
    // (10 * 1.00 + 3 * 2.00) / 13 = 16 / 13 = 1.230769...
    const result = computeWeightedAverageCost(10, 1.0, 3, 2.0)
    expect(result).toBe(1.2308)
  })
})

// ---------------------------------------------------------------------------
// computeStockLevel
// ---------------------------------------------------------------------------
describe('computeStockLevel', () => {
  it('OK: physical=100, reserved=20, minLevel=50', () => {
    const result = computeStockLevel(100, 20, 50)
    expect(result).toEqual({
      physical: 100,
      available: 80,
      reserved: 20,
      status: 'OK',
    })
  })

  it('LOW: physical=30, reserved=10, minLevel=50', () => {
    const result = computeStockLevel(30, 10, 50)
    expect(result).toEqual({
      physical: 30,
      available: 20,
      reserved: 10,
      status: 'LOW',
    })
  })

  it('OUT: physical=0, reserved=0, minLevel=50', () => {
    const result = computeStockLevel(0, 0, 50)
    expect(result).toEqual({
      physical: 0,
      available: 0,
      reserved: 0,
      status: 'OUT',
    })
  })

  it('OK with null minLevel: physical=100, reserved=0', () => {
    const result = computeStockLevel(100, 0, null)
    expect(result).toEqual({
      physical: 100,
      available: 100,
      reserved: 0,
      status: 'OK',
    })
  })

  it('OUT when physical is negative', () => {
    const result = computeStockLevel(-5, 0, 10)
    expect(result).toEqual({
      physical: -5,
      available: -5,
      reserved: 0,
      status: 'OUT',
    })
  })

  it('LOW: physical exactly equals minLevel', () => {
    const result = computeStockLevel(50, 0, 50)
    expect(result).toEqual({
      physical: 50,
      available: 50,
      reserved: 0,
      status: 'LOW',
    })
  })

  it('OK: physical just above minLevel', () => {
    const result = computeStockLevel(51, 0, 50)
    expect(result).toEqual({
      physical: 51,
      available: 51,
      reserved: 0,
      status: 'OK',
    })
  })
})

// ---------------------------------------------------------------------------
// validateMovement
// ---------------------------------------------------------------------------
describe('validateMovement', () => {
  it('OUTBOUND without lot_id is invalid', () => {
    const result = validateMovement({
      movement_type: 'OUTBOUND',
      reason: 'VENDITA',
    })
    expect(result).toEqual({
      valid: false,
      reason: 'Per uno scarico è necessario specificare il lotto',
    })
  })

  it('TRANSFER without to_warehouse_id is invalid', () => {
    const result = validateMovement({
      movement_type: 'TRANSFER',
      reason: 'TRASFERIMENTO_OUT',
    })
    expect(result).toEqual({
      valid: false,
      reason:
        'Per un trasferimento è necessario specificare il magazzino di destinazione',
    })
  })

  it('INBOUND with reason ACQUISTO is valid', () => {
    const result = validateMovement({
      movement_type: 'INBOUND',
      reason: 'ACQUISTO',
    })
    expect(result).toEqual({ valid: true })
  })

  it('OUTBOUND with reason VENDITA and lot_id is valid', () => {
    const result = validateMovement({
      movement_type: 'OUTBOUND',
      reason: 'VENDITA',
      lot_id: 'lot-123',
    })
    expect(result).toEqual({ valid: true })
  })

  it('TRANSFER with reason TRASFERIMENTO_OUT and to_warehouse_id is valid', () => {
    const result = validateMovement({
      movement_type: 'TRANSFER',
      reason: 'TRASFERIMENTO_OUT',
      to_warehouse_id: 'wh-456',
    })
    expect(result).toEqual({ valid: true })
  })

  it('ADJUSTMENT is always valid', () => {
    const result = validateMovement({
      movement_type: 'ADJUSTMENT',
      reason: 'RETTIFICA',
    })
    expect(result).toEqual({ valid: true })
  })

  it('ADJUSTMENT without optional fields is valid', () => {
    const result = validateMovement({
      movement_type: 'ADJUSTMENT',
      reason: 'INVENTARIO',
    })
    expect(result).toEqual({ valid: true })
  })
})
