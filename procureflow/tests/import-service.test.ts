import { describe, it, expect } from 'vitest'
import { detectSeparator, parseCsvRows } from '@/server/services/import.service'

describe('detectSeparator', () => {
  it('detects comma as separator', () => {
    const text = 'codice,nome,email\nV001,Acme,acme@test.com'
    expect(detectSeparator(text)).toBe(',')
  })

  it('detects semicolon as separator', () => {
    const text = 'codice;nome;email\nV001;Acme;acme@test.com'
    expect(detectSeparator(text)).toBe(';')
  })

  it('defaults to comma when counts are equal', () => {
    const text = 'codice'
    expect(detectSeparator(text)).toBe(',')
  })

  it('handles empty string', () => {
    expect(detectSeparator('')).toBe(',')
  })
})

describe('parseCsvRows', () => {
  it('parses comma-separated CSV', () => {
    const csv =
      'codice,nome,email\nV001,Acme,acme@test.com\nV002,Beta,beta@test.com'
    const rows = parseCsvRows(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]!).toEqual({
      codice: 'V001',
      nome: 'Acme',
      email: 'acme@test.com',
    })
    expect(rows[1]!).toEqual({
      codice: 'V002',
      nome: 'Beta',
      email: 'beta@test.com',
    })
  })

  it('parses semicolon-separated CSV', () => {
    const csv = 'codice;nome;email\nV001;Acme;acme@test.com'
    const rows = parseCsvRows(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]!).toEqual({
      codice: 'V001',
      nome: 'Acme',
      email: 'acme@test.com',
    })
  })

  it('strips BOM from beginning of file', () => {
    const csv = '\uFEFFcodice,nome\nV001,Acme'
    const rows = parseCsvRows(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.codice).toBe('V001')
  })

  it('trims whitespace from values', () => {
    const csv = 'codice , nome \n V001 , Acme Corp '
    const rows = parseCsvRows(csv)
    expect(rows[0]!).toEqual({
      codice: 'V001',
      nome: 'Acme Corp',
    })
  })

  it('skips empty lines', () => {
    const csv = 'codice,nome\nV001,Acme\n\nV002,Beta\n'
    const rows = parseCsvRows(csv)
    expect(rows).toHaveLength(2)
  })

  it('returns frozen array', () => {
    const csv = 'codice,nome\nV001,Acme'
    const rows = parseCsvRows(csv)
    expect(Object.isFrozen(rows)).toBe(true)
  })
})
