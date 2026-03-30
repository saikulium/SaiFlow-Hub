import { prisma } from '@/lib/db'

export type ExportEntity =
  | 'vendors'
  | 'materials'
  | 'requests'
  | 'invoices'
  | 'users'
  | 'budgets'

interface ExportColumn {
  readonly key: string
  readonly label: string
}

export const EXPORT_COLUMNS: Readonly<
  Record<ExportEntity, readonly ExportColumn[]>
> = Object.freeze({
  vendors: Object.freeze([
    { key: 'code', label: 'codice' },
    { key: 'name', label: 'nome' },
    { key: 'email', label: 'email' },
    { key: 'phone', label: 'telefono' },
    { key: 'website', label: 'sito_web' },
    { key: 'category', label: 'categorie' },
    { key: 'payment_terms', label: 'termini_pagamento' },
    { key: 'rating', label: 'rating' },
    { key: 'status', label: 'stato' },
    { key: 'notes', label: 'note' },
  ]),
  materials: Object.freeze([
    { key: 'code', label: 'codice' },
    { key: 'name', label: 'nome' },
    { key: 'unit_primary', label: 'unita' },
    { key: 'min_stock_level', label: 'livello_minimo' },
    { key: 'preferred_vendor_code', label: 'fornitore_codice' },
    { key: 'category', label: 'categoria' },
    { key: 'is_active', label: 'attivo' },
  ]),
  requests: Object.freeze([
    { key: 'code', label: 'codice' },
    { key: 'title', label: 'titolo' },
    { key: 'status', label: 'stato' },
    { key: 'priority', label: 'priorita' },
    { key: 'requester_name', label: 'richiedente_nome' },
    { key: 'vendor_name', label: 'fornitore_nome' },
    { key: 'estimated_amount', label: 'importo_stimato' },
    { key: 'actual_amount', label: 'importo_effettivo' },
    { key: 'currency', label: 'valuta' },
    { key: 'created_at', label: 'data_creazione' },
    { key: 'delivered_at', label: 'data_consegna' },
  ]),
  invoices: Object.freeze([
    { key: 'invoice_number', label: 'numero' },
    { key: 'vendor_name', label: 'fornitore_nome' },
    { key: 'total_amount', label: 'importo' },
    { key: 'currency', label: 'valuta' },
    { key: 'received_at', label: 'data_ricezione' },
    { key: 'reconciliation_status', label: 'stato_riconciliazione' },
    { key: 'sdi_id', label: 'sdi_id' },
  ]),
  users: Object.freeze([
    { key: 'name', label: 'nome' },
    { key: 'email', label: 'email' },
    { key: 'role', label: 'ruolo' },
    { key: 'department', label: 'dipartimento' },
    { key: 'created_at', label: 'data_creazione' },
  ]),
  budgets: Object.freeze([
    { key: 'cost_center', label: 'centro_costo' },
    { key: 'department', label: 'dipartimento' },
    { key: 'allocated_amount', label: 'importo_allocato' },
    { key: 'spent', label: 'speso' },
    { key: 'committed', label: 'impegnato' },
    { key: 'available', label: 'disponibile' },
    { key: 'period_start', label: 'periodo_inizio' },
    { key: 'period_end', label: 'periodo_fine' },
  ]),
})

const VALID_ENTITIES: readonly ExportEntity[] = Object.freeze([
  'vendors',
  'materials',
  'requests',
  'invoices',
  'users',
  'budgets',
])

export function isValidEntity(value: string): value is ExportEntity {
  return (VALID_ENTITIES as readonly string[]).includes(value)
}

/**
 * Escapa un valore per l'inclusione in CSV.
 * Se contiene virgola, doppi apici o newline, viene racchiuso tra apici.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  let str = String(value)

  // Neutralize CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Genera CSV da array di righe e definizione colonne.
 */
export function toCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly ExportColumn[],
): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',')
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(','),
  )
  return [header, ...dataLines].join('\n')
}

/**
 * Recupera i dati di un'entità dal database, formattati per l'export.
 * ESCLUDI dati sensibili (password, TOTP, token).
 */
export async function fetchEntityData(
  entity: ExportEntity,
): Promise<readonly Record<string, unknown>[]> {
  switch (entity) {
    case 'vendors':
      return fetchVendors()
    case 'materials':
      return fetchMaterials()
    case 'requests':
      return fetchRequests()
    case 'invoices':
      return fetchInvoices()
    case 'users':
      return fetchUsers()
    case 'budgets':
      return fetchBudgets()
  }
}

async function fetchVendors(): Promise<readonly Record<string, unknown>[]> {
  const vendors = await prisma.vendor.findMany({
    orderBy: { code: 'asc' },
  })
  return Object.freeze(
    vendors.map((v) =>
      Object.freeze({
        code: v.code,
        name: v.name,
        email: v.email,
        phone: v.phone,
        website: v.website,
        category: v.category.join(','),
        payment_terms: v.payment_terms,
        rating: v.rating,
        status: v.status,
        notes: v.notes,
      }),
    ),
  )
}

async function fetchMaterials(): Promise<readonly Record<string, unknown>[]> {
  const materials = await prisma.material.findMany({
    include: { preferred_vendor: { select: { code: true } } },
    orderBy: { code: 'asc' },
  })
  return Object.freeze(
    materials.map((m) =>
      Object.freeze({
        code: m.code,
        name: m.name,
        unit_primary: m.unit_primary,
        min_stock_level: m.min_stock_level?.toString() ?? '',
        preferred_vendor_code: m.preferred_vendor?.code ?? '',
        category: m.category,
        is_active: m.is_active ? 'Sì' : 'No',
      }),
    ),
  )
}

async function fetchRequests(): Promise<readonly Record<string, unknown>[]> {
  const requests = await prisma.purchaseRequest.findMany({
    include: {
      requester: { select: { name: true } },
      vendor: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })
  return Object.freeze(
    requests.map((r) =>
      Object.freeze({
        code: r.code,
        title: r.title,
        status: r.status,
        priority: r.priority,
        requester_name: r.requester.name,
        vendor_name: r.vendor?.name ?? '',
        estimated_amount: r.estimated_amount?.toString() ?? '',
        actual_amount: r.actual_amount?.toString() ?? '',
        currency: r.currency,
        created_at: r.created_at.toISOString(),
        delivered_at: r.delivered_at?.toISOString() ?? '',
      }),
    ),
  )
}

async function fetchInvoices(): Promise<readonly Record<string, unknown>[]> {
  const invoices = await prisma.invoice.findMany({
    include: { vendor: { select: { name: true } } },
    orderBy: { invoice_date: 'desc' },
  })
  return Object.freeze(
    invoices.map((inv) =>
      Object.freeze({
        invoice_number: inv.invoice_number,
        vendor_name: inv.vendor?.name ?? inv.supplier_name,
        total_amount: inv.total_amount.toString(),
        currency: inv.currency,
        received_at: inv.received_at.toISOString(),
        reconciliation_status: inv.reconciliation_status,
        sdi_id: inv.sdi_id ?? '',
      }),
    ),
  )
}

async function fetchUsers(): Promise<readonly Record<string, unknown>[]> {
  const users = await prisma.user.findMany({
    select: {
      name: true,
      email: true,
      role: true,
      department: true,
      created_at: true,
      // Explicitly exclude: password_hash, totp_secret, recovery_codes, token_version
    },
    orderBy: { created_at: 'asc' },
  })
  return Object.freeze(
    users.map((u) =>
      Object.freeze({
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        created_at: u.created_at.toISOString(),
      }),
    ),
  )
}

async function fetchBudgets(): Promise<readonly Record<string, unknown>[]> {
  const budgets = await prisma.budget.findMany({
    include: {
      snapshots: {
        orderBy: { computed_at: 'desc' },
        take: 1,
      },
    },
    orderBy: { cost_center: 'asc' },
  })
  return Object.freeze(
    budgets.map((b) => {
      const latestSnapshot = b.snapshots[0]
      return Object.freeze({
        cost_center: b.cost_center,
        department: b.department,
        allocated_amount: b.allocated_amount.toString(),
        spent: latestSnapshot?.spent.toString() ?? '',
        committed: latestSnapshot?.committed.toString() ?? '',
        available: latestSnapshot?.available.toString() ?? '',
        period_start: b.period_start.toISOString(),
        period_end: b.period_end.toISOString(),
      })
    }),
  )
}
