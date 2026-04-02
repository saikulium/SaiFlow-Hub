import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockQueryRawUnsafe, mockTransaction } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (fn: Function, opts?: unknown) => mockTransaction(fn, opts),
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}))

import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

describe('generateNextCodeAtomic', () => {
  const year = new Date().getFullYear()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: transaction executes the callback with a tx client
    mockTransaction.mockImplementation(async (fn) => {
      const tx = { $queryRawUnsafe: mockQueryRawUnsafe }
      return fn(tx)
    })
  })

  it('generates PR code with default args (backwards compatible)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([])
    const code = await generateNextCodeAtomic()
    expect(code).toBe(`PR-${year}-00001`)
  })

  it('generates COM code when prefix and table provided', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([])
    const code = await generateNextCodeAtomic('COM', 'commesse')
    expect(code).toBe(`COM-${year}-00001`)
  })

  it('increments from last existing code', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ code: `COM-${year}-00003` }])
    const code = await generateNextCodeAtomic('COM', 'commesse')
    expect(code).toBe(`COM-${year}-00004`)
  })

  it('generates CLI code without year (noYear flag)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([])
    const code = await generateNextCodeAtomic('CLI', 'clients', undefined, true)
    expect(code).toBe('CLI-001')
  })

  it('increments CLI code without year', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ code: 'CLI-042' }])
    const code = await generateNextCodeAtomic('CLI', 'clients', undefined, true)
    expect(code).toBe('CLI-043')
  })

  it('uses external transaction client when provided', async () => {
    const externalTx = { $queryRawUnsafe: vi.fn().mockResolvedValueOnce([]) }
    // When tx is provided, should NOT call prisma.$transaction
    const code = await generateNextCodeAtomic('COM', 'commesse', externalTx as any)
    expect(code).toBe(`COM-${year}-00001`)
    expect(externalTx.$queryRawUnsafe).toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
