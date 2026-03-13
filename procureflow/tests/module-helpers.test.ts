import { describe, it, expect } from 'vitest'
import {
  isModuleEnabled,
  isPathEnabled,
  isApiPrefixEnabled,
  filterNavItems,
  filterDashboardTabs,
} from '../src/lib/modules/helpers'

// --- isModuleEnabled ---

describe('isModuleEnabled', () => {
  it('core is always enabled even if not in list', () => {
    expect(isModuleEnabled([], 'core')).toBe(true)
    expect(isModuleEnabled(['invoicing'], 'core')).toBe(true)
  })

  it('returns true for modules in the list', () => {
    expect(isModuleEnabled(['core', 'invoicing', 'budgets'], 'invoicing')).toBe(true)
    expect(isModuleEnabled(['core', 'invoicing', 'budgets'], 'budgets')).toBe(true)
  })

  it('returns false for modules not in the list', () => {
    expect(isModuleEnabled(['core'], 'invoicing')).toBe(false)
    expect(isModuleEnabled(['core', 'invoicing'], 'tenders')).toBe(false)
  })
})

// --- isPathEnabled ---

describe('isPathEnabled', () => {
  const allModules = ['core', 'invoicing', 'budgets', 'analytics']
  const coreOnly = ['core']

  it('core paths are always enabled', () => {
    expect(isPathEnabled(coreOnly, '/')).toBe(true)
    expect(isPathEnabled(coreOnly, '/requests')).toBe(true)
    expect(isPathEnabled(coreOnly, '/vendors')).toBe(true)
    expect(isPathEnabled(coreOnly, '/approvals')).toBe(true)
  })

  it('invoicing paths enabled when module is active', () => {
    expect(isPathEnabled(allModules, '/invoices')).toBe(true)
  })

  it('invoicing paths disabled when module is inactive', () => {
    expect(isPathEnabled(coreOnly, '/invoices')).toBe(false)
  })

  it('budget paths follow module state', () => {
    expect(isPathEnabled(['core', 'budgets'], '/budgets')).toBe(true)
    expect(isPathEnabled(coreOnly, '/budgets')).toBe(false)
  })

  it('analytics paths follow module state', () => {
    expect(isPathEnabled(['core', 'analytics'], '/analytics')).toBe(true)
    expect(isPathEnabled(coreOnly, '/analytics')).toBe(false)
  })

  it('unknown paths are enabled by default', () => {
    expect(isPathEnabled(coreOnly, '/some-unknown-page')).toBe(true)
  })

  it('handles nested paths', () => {
    expect(isPathEnabled(coreOnly, '/invoices/123')).toBe(false)
    expect(isPathEnabled(allModules, '/invoices/123')).toBe(true)
  })
})

// --- isApiPrefixEnabled ---

describe('isApiPrefixEnabled', () => {
  const coreOnly = ['core']

  it('core API routes are always enabled', () => {
    expect(isApiPrefixEnabled(coreOnly, '/api/requests')).toBe(true)
    expect(isApiPrefixEnabled(coreOnly, '/api/vendors')).toBe(true)
    expect(isApiPrefixEnabled(coreOnly, '/api/auth')).toBe(true)
  })

  it('invoice API blocked when module inactive', () => {
    expect(isApiPrefixEnabled(coreOnly, '/api/invoices')).toBe(false)
    expect(isApiPrefixEnabled(coreOnly, '/api/invoices/upload')).toBe(false)
  })

  it('invoice API allowed when module active', () => {
    expect(isApiPrefixEnabled(['core', 'invoicing'], '/api/invoices')).toBe(true)
  })

  it('budget API follows module state', () => {
    expect(isApiPrefixEnabled(coreOnly, '/api/budgets')).toBe(false)
    expect(isApiPrefixEnabled(['core', 'budgets'], '/api/budgets')).toBe(true)
    expect(isApiPrefixEnabled(['core', 'budgets'], '/api/budgets/check')).toBe(true)
  })
})

// --- filterNavItems ---

describe('filterNavItems', () => {
  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/requests', label: 'Richieste' },
    { href: '/invoices', label: 'Fatture' },
    { href: '/budgets', label: 'Budget' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/settings', label: 'Impostazioni' },
  ]

  it('shows all items when all modules enabled', () => {
    const result = filterNavItems(
      ['core', 'invoicing', 'budgets', 'analytics'],
      navItems,
    )
    expect(result).toHaveLength(6)
  })

  it('filters out disabled module items', () => {
    const result = filterNavItems(['core'], navItems)
    const labels = result.map((i) => i.label)
    expect(labels).toContain('Dashboard')
    expect(labels).toContain('Richieste')
    expect(labels).toContain('Impostazioni')
    expect(labels).not.toContain('Fatture')
    expect(labels).not.toContain('Budget')
    expect(labels).not.toContain('Analytics')
  })

  it('selectively enables modules', () => {
    const result = filterNavItems(['core', 'invoicing'], navItems)
    const labels = result.map((i) => i.label)
    expect(labels).toContain('Fatture')
    expect(labels).not.toContain('Budget')
  })
})

// --- filterDashboardTabs ---

describe('filterDashboardTabs', () => {
  const tabs = [
    { id: 'panoramica', label: 'Panoramica' },
    { id: 'fatture', label: 'Fatture' },
    { id: 'budget', label: 'Budget' },
    { id: 'analisi', label: 'Analisi' },
  ]

  it('shows all tabs when all modules enabled', () => {
    const result = filterDashboardTabs(
      ['core', 'invoicing', 'budgets', 'analytics'],
      tabs,
    )
    expect(result).toHaveLength(4)
  })

  it('filters out disabled module tabs', () => {
    const result = filterDashboardTabs(['core'], tabs)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('panoramica')
  })

  it('keeps panoramica even with empty enabled list', () => {
    const result = filterDashboardTabs([], tabs)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('panoramica')
  })

  it('selectively enables tabs', () => {
    const result = filterDashboardTabs(['core', 'budgets'], tabs)
    const ids = result.map((t) => t.id)
    expect(ids).toContain('panoramica')
    expect(ids).toContain('budget')
    expect(ids).not.toContain('fatture')
    expect(ids).not.toContain('analisi')
  })
})
