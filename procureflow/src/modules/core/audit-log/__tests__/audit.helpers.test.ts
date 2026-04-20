import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetCtx } = vi.hoisted(() => ({
  mockGetCtx: vi.fn(),
}))

vi.mock('@/lib/audit-context', () => ({
  getCurrentAuditContext: mockGetCtx,
  setAuditContext: <T>(_: unknown, fn: () => Promise<T>) => fn(),
}))

import {
  resolveContext,
  entityLabel,
  diffRecords,
  createChanges,
} from '../server/audit.helpers'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCtx.mockReturnValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveContext', () => {
  it('returns the stored context when available', () => {
    mockGetCtx.mockReturnValue({
      actorId: 'u1',
      actorType: 'USER',
      actorLabel: 'a@b',
    })
    expect(resolveContext()).toMatchObject({ actorId: 'u1' })
  })

  it('warns + returns UNKNOWN actor in non-production when context missing', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = resolveContext()
    expect(ctx).toMatchObject({ actorType: 'USER', actorLabel: 'UNKNOWN' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('throws in production when context missing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => resolveContext()).toThrow(/Missing audit context/)
  })
})

describe('entityLabel', () => {
  it('returns the mapped label field value when present', () => {
    expect(entityLabel('PurchaseRequest', { code: 'PR-001' })).toBe('PR-001')
    expect(entityLabel('User', { email: 'a@b.com' })).toBe('a@b.com')
  })

  it('returns null when model not mapped or record missing field', () => {
    expect(entityLabel('Unmapped', { code: 'X' })).toBeNull()
    expect(entityLabel('Vendor', {})).toBeNull()
    expect(entityLabel('User', null)).toBeNull()
  })
})

describe('diffRecords', () => {
  it('only emits changed fields with {old,new}', () => {
    const before = { name: 'old', qty: 1, tags: ['a'] }
    const after = { name: 'new', qty: 1, tags: ['a'] }
    const changes = diffRecords('PurchaseRequest', before, after)
    expect(Object.keys(changes)).toEqual(['name'])
    expect(changes.name).toEqual({ old: 'old', new: 'new' })
  })

  it('treats undefined and missing as null to avoid noise', () => {
    const before = { status: 'DRAFT' }
    const after = { status: 'DRAFT', deleted_at: null }
    expect(diffRecords('X', before, after)).toEqual({})
  })

  it('restricts User diff to USER_AUDITED_FIELDS only', () => {
    const before = {
      role: 'REQUESTER',
      password_hash: 'h1',
      last_login_at: new Date('2026-01-01'),
    }
    const after = {
      role: 'ADMIN',
      password_hash: 'h2',
      last_login_at: new Date('2026-02-01'),
    }
    const changes = diffRecords('User', before, after)
    expect(Object.keys(changes)).toEqual(['role'])
    expect(changes.role).toEqual({ old: 'REQUESTER', new: 'ADMIN' })
  })

  it('emits nested object change as full replacement', () => {
    const before = { meta: { a: 1 } }
    const after = { meta: { a: 2 } }
    const changes = diffRecords('X', before, after)
    expect(changes.meta).toEqual({ old: { a: 1 }, new: { a: 2 } })
  })
})

describe('createChanges', () => {
  it('emits all non-null fields with old=null', () => {
    const changes = createChanges('PurchaseRequest', {
      code: 'PR-001',
      title: 'Test',
      notes: null,
    })
    expect(Object.keys(changes).sort()).toEqual(['code', 'title'])
    expect(changes.code).toEqual({ old: null, new: 'PR-001' })
  })

  it('restricts User create to USER_AUDITED_FIELDS', () => {
    const changes = createChanges('User', {
      email: 'x@y',
      role: 'ADMIN',
      password_hash: 'secret',
      totp_secret: 'topsecret',
    })
    expect(Object.keys(changes).sort()).toEqual(['email', 'role'])
  })
})
