import { parse } from 'csv-parse/sync'
import { prisma } from '@/lib/db'

const MAX_ROWS = 10_000
const BOM = '\uFEFF'

interface ImportError {
  readonly row: number
  readonly message: string
}

interface ImportResult {
  readonly created: number
  readonly updated: number
  readonly errors: readonly ImportError[]
}

/**
 * Rileva il separatore CSV analizzando la prima riga.
 * Conta le occorrenze di virgola e punto e virgola.
 */
export function detectSeparator(text: string): ',' | ';' {
  const firstLine = text.split('\n')[0] ?? ''
  const commas = (firstLine.match(/,/g) ?? []).length
  const semicolons = (firstLine.match(/;/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

/**
 * Parsa testo CSV in array di record.
 * Gestisce BOM, rileva separatore, limita a MAX_ROWS righe.
 */
export function parseCsvRows(text: string): readonly Record<string, string>[] {
  const cleaned = text.startsWith(BOM) ? text.slice(1) : text
  const separator = detectSeparator(cleaned)

  const records = parse(cleaned, {
    columns: true,
    delimiter: separator,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[]

  if (records.length > MAX_ROWS) {
    throw new Error(
      `Il file contiene ${records.length} righe, massimo consentito: ${MAX_ROWS}`,
    )
  }

  return Object.freeze(records)
}

/**
 * Importa fornitori da CSV. Upsert per campo `codice`.
 *
 * Colonne attese: codice, nome, email, telefono, sito_web, categorie, termini_pagamento, note
 * Obbligatori: codice, nome
 */
export async function importVendors(csvText: string): Promise<ImportResult> {
  const rows = parseCsvRows(csvText)
  let created = 0
  let updated = 0
  const errors: ImportError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string>
    const lineNum = i + 2 // header is line 1

    const codice = row.codice?.trim()
    const nome = row.nome?.trim()

    if (!codice || !nome) {
      errors.push({
        row: lineNum,
        message: 'Campi obbligatori mancanti (codice, nome)',
      })
      continue
    }

    const categories = row.categorie
      ? row.categorie
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : []

    try {
      const existing = await prisma.vendor.findUnique({
        where: { code: codice },
        select: { id: true },
      })

      await prisma.vendor.upsert({
        where: { code: codice },
        update: {
          name: nome,
          email: row.email?.trim() || null,
          phone: row.telefono?.trim() || null,
          website: row.sito_web?.trim() || null,
          category: categories,
          payment_terms: row.termini_pagamento?.trim() || null,
          notes: row.note?.trim() || null,
        },
        create: {
          code: codice,
          name: nome,
          email: row.email?.trim() || null,
          phone: row.telefono?.trim() || null,
          website: row.sito_web?.trim() || null,
          category: categories,
          payment_terms: row.termini_pagamento?.trim() || null,
          notes: row.note?.trim() || null,
        },
      })

      if (existing) {
        updated++
      } else {
        created++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ row: lineNum, message: `Errore DB — ${msg}` })
    }
  }

  return Object.freeze({ created, updated, errors: Object.freeze(errors) })
}

/**
 * Importa materiali da CSV. Upsert per campo `codice`.
 *
 * Colonne attese: codice, nome, unita, livello_minimo, fornitore_codice, categoria
 * Obbligatori: codice, nome
 */
export async function importMaterials(csvText: string): Promise<ImportResult> {
  const rows = parseCsvRows(csvText)
  let created = 0
  let updated = 0
  const errors: ImportError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, string>
    const lineNum = i + 2

    const codice = row.codice?.trim()
    const nome = row.nome?.trim()

    if (!codice || !nome) {
      errors.push({
        row: lineNum,
        message: 'Campi obbligatori mancanti (codice, nome)',
      })
      continue
    }

    let preferredVendorId: string | null = null
    const vendorCode = row.fornitore_codice?.trim()
    if (vendorCode) {
      const vendor = await prisma.vendor.findUnique({
        where: { code: vendorCode },
        select: { id: true },
      })
      if (!vendor) {
        errors.push({
          row: lineNum,
          message: `Fornitore con codice "${vendorCode}" non trovato`,
        })
        continue
      }
      preferredVendorId = vendor.id
    }

    const minStockLevel = row.livello_minimo
      ? parseFloat(row.livello_minimo)
      : null

    try {
      const existing = await prisma.material.findUnique({
        where: { code: codice },
        select: { id: true },
      })

      await prisma.material.upsert({
        where: { code: codice },
        update: {
          name: nome,
          unit_primary: row.unita?.trim() || 'pz',
          min_stock_level:
            minStockLevel !== null && !isNaN(minStockLevel)
              ? minStockLevel
              : null,
          preferred_vendor_id: preferredVendorId,
          category: row.categoria?.trim() || null,
        },
        create: {
          code: codice,
          name: nome,
          unit_primary: row.unita?.trim() || 'pz',
          min_stock_level:
            minStockLevel !== null && !isNaN(minStockLevel)
              ? minStockLevel
              : null,
          preferred_vendor_id: preferredVendorId,
          category: row.categoria?.trim() || null,
        },
      })

      if (existing) {
        updated++
      } else {
        created++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ row: lineNum, message: `Errore DB — ${msg}` })
    }
  }

  return Object.freeze({ created, updated, errors: Object.freeze(errors) })
}
