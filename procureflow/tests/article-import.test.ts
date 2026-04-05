import { describe, it, expect } from 'vitest'
import { parseCsvRows } from '../src/server/services/article-import.service'

describe('parseCsvRows', () => {
  it('groups rows by codice_interno', () => {
    const rows = [
      { codice_interno: 'ART-001', nome: 'Test', um: 'pz', tipo_alias: 'vendor' as const, codice_alias: 'V-001', entita: 'Amphenol' },
      { codice_interno: 'ART-001', nome: 'Test', um: 'pz', tipo_alias: 'client' as const, codice_alias: 'C-001', entita: 'Leonardo' },
      { codice_interno: 'ART-002', nome: 'Other', um: 'kg' },
    ]

    const groups = parseCsvRows(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.codice_interno).toBe('ART-001')
    expect(groups[0]?.aliases).toHaveLength(2)
    expect(groups[1]?.codice_interno).toBe('ART-002')
    expect(groups[1]?.aliases).toHaveLength(0)
  })

  it('ignores rows without codice_alias in alias list', () => {
    const rows = [
      { codice_interno: 'ART-001', nome: 'Test', um: 'pz', tipo_alias: 'vendor' as const },
    ]

    const groups = parseCsvRows(rows)
    expect(groups[0]?.aliases).toHaveLength(0)
  })
})
