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

export const EXPORT_COLUMNS: Readonly<Record<ExportEntity, readonly ExportColumn[]>> = Object.freeze({
  vendors: Object.freeze([
    { key: 'code', label: 'Codice' },
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefono' },
    { key: 'website', label: 'Sito Web' },
    { key: 'vat_id', label: 'Partita IVA' },
    { key: 'category', label: 'Categorie' },
    { key: 'payment_terms', label: 'Termini Pagamento' },
    { key: 'rating', label: 'Rating' },
    { key: 'status', label: 'Stato' },
    { key: 'notes', label: 'Note' },
  ]),
  materials: Object.freeze([
    { key: 'code', label: 'Codice' },
    { key: 'name', label: 'Nome' },
    { key: 'category', label: 'Categoria' },
    { key: 'unit_primary', label: 'Unità' },
    { key: 'min_stock_level', label: 'Livello Minimo' },
    { key: 'unit_cost', label: 'Costo Unitario' },
    { key: 'preferred_vendor_code', label: 'Fornitore Preferito' },
    { key: 'is_active', label: 'Attivo' },
  ]),
  requests: Object.freeze([
    { key: 'code', label: 'Codice' },
    { key: 'title', label: 'Titolo' },
    { key: 'status', label: 'Stato' },
    { key: 'priority', label: 'Priorità' },
    { key: 'requester_name', label: 'Richiedente' },
    { key: 'vendor_name', label: 'Fornitore' },
    { key: 'estimated_amount', label: 'Importo Stimato' },
    { key: 'actual_amount', label: 'Importo Effettivo' },
    { key: 'currency', label: 'Valuta' },
    { key: 'department', label: 'Dipartimento' },
    { key: 'cost_center', label: 'Centro Costo' },
    { key: 'needed_by', label: 'Data Necessità' },
    { key: 'created_at', label: 'Data Creazione' },
  ]),
  invoices: Object.freeze([
    { key: 'invoice_number', label: 'Numero Fattura' },
    { key: 'invoice_date', label: 'Data Fattura' },
    { key: 'supplier_name', label: 'Fornitore' },
    { key: 'supplier_vat_id', label: 'P.IVA Fornitore' },
    { key: 'total_taxable', label: 'Imponibile' },
    { key: 'total_tax', label: 'IVA' },
    { key: 'total_amount', label: 'Totale' },
    { key: 'currency', label: 'Valuta' },
    { key: 'match_status', label: 'Stato Matching' },
    { key: 'reconciliation_status', label: 'Stato Riconciliazione' },
    { key: 'vendor_name', label: 'Fornitore (DB)' },
  ]),
  users: Object.freeze([
    { key: 'id', label: 'ID' },
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Nome' },
    { key: 'role', label: 'Ruolo' },
    { key: 'department', label: 'Dipartimento' },
    { key: 'totp_enabled', label: 'MFA Attivo' },
    { key: 'onboarding_completed', label: 'Onboarding Completato' },
    { key: 'created_at', label: 'Data Creazione' },
  ]),
  budgets: Object.freeze([
    { key: 'cost_center', label: 'Centro Costo' },
    { key: 'department', label: 'Dipartimento' },
    { key: 'period_type', label: 'Tipo Periodo' },
    { key: 'period_start', label: 'Inizio Periodo' },
    { key: 'period_end', label: 'Fine Periodo' },
    { key: 'allocated_amount', label: 'Importo Allocato' },
    { key: 'enforcement_mode', label: 'Modalità Enforcement' },
    { key: 'is_active', label: 'Attivo' },
    { key: 'spent', label: 'Speso' },
    { key: 'committed', label: 'Impegnato' },
    { key: 'available', label: 'Disponibile' },
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
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
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
        vat_id: v.vat_id,
        category: v.category.join(';'),
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
        category: m.category,
        unit_primary: m.unit_primary,
        min_stock_level: m.min_stock_level?.toString() ?? '',
        unit_cost: m.unit_cost.toString(),
        preferred_vendor_code: m.preferred_vendor?.code ?? '',
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
        department: r.department,
        cost_center: r.cost_center,
        needed_by: r.needed_by?.toISOString() ?? '',
        created_at: r.created_at.toISOString(),
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
        invoice_date: inv.invoice_date.toISOString(),
        supplier_name: inv.supplier_name,
        supplier_vat_id: inv.supplier_vat_id,
        total_taxable: inv.total_taxable.toString(),
        total_tax: inv.total_tax.toString(),
        total_amount: inv.total_amount.toString(),
        currency: inv.currency,
        match_status: inv.match_status,
        reconciliation_status: inv.reconciliation_status,
        vendor_name: inv.vendor?.name ?? '',
      }),
    ),
  )
}

async function fetchUsers(): Promise<readonly Record<string, unknown>[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      totp_enabled: true,
      onboarding_completed: true,
      created_at: true,
      // Explicitly exclude: password_hash, totp_secret, recovery_codes, token_version
    },
    orderBy: { created_at: 'asc' },
  })
  return Object.freeze(
    users.map((u) =>
      Object.freeze({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        totp_enabled: u.totp_enabled ? 'Sì' : 'No',
        onboarding_completed: u.onboarding_completed ? 'Sì' : 'No',
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
        period_type: b.period_type,
        period_start: b.period_start.toISOString(),
        period_end: b.period_end.toISOString(),
        allocated_amount: b.allocated_amount.toString(),
        enforcement_mode: b.enforcement_mode,
        is_active: b.is_active ? 'Sì' : 'No',
        spent: latestSnapshot?.spent.toString() ?? '',
        committed: latestSnapshot?.committed.toString() ?? '',
        available: latestSnapshot?.available.toString() ?? '',
      })
    }),
  )
}
