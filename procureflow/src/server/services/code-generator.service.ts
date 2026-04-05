import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Generazione atomica di codici sequenziali (PR, COM, CLI, etc.)
//
// Usa SELECT ... FOR UPDATE per garantire unicità sotto richieste concorrenti.
// Accetta un prefix, il nome della tabella, e opzionalmente un transaction
// client esterno (per quando il chiamante è già in una $transaction).
// ---------------------------------------------------------------------------

const ALLOWED_TABLES = [
  'purchase_requests',
  'commesse',
  'clients',
  'articles',
] as const
type AllowedTable = (typeof ALLOWED_TABLES)[number]
type TxClient = Prisma.TransactionClient

export async function generateNextCodeAtomic(
  prefix = 'PR',
  table: AllowedTable = 'purchase_requests',
  externalTx?: TxClient,
  noYear = false,
): Promise<string> {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`)
  }

  const year = new Date().getFullYear()
  const fullPrefix = noYear ? `${prefix}-` : `${prefix}-${year}-`
  const padLen = noYear ? 3 : 5

  async function generate(tx: TxClient): Promise<string> {
    const rows = await tx.$queryRawUnsafe<{ code: string }[]>(
      `SELECT code FROM "${table}"
       WHERE code LIKE $1
       ORDER BY code DESC
       LIMIT 1
       FOR UPDATE`,
      `${fullPrefix}%`,
    )

    const lastCode = rows[0]?.code
    const lastNum = lastCode
      ? parseInt(lastCode.split('-').pop() ?? '0', 10)
      : 0

    if (Number.isNaN(lastNum)) {
      throw new Error(`Corrupted code found in ${table}: "${lastCode}"`)
    }

    return `${fullPrefix}${String(lastNum + 1).padStart(padLen, '0')}`
  }

  // If caller provided a transaction, use it directly (no nested $transaction)
  if (externalTx) {
    return generate(externalTx)
  }

  return prisma.$transaction(async (tx) => generate(tx), { timeout: 5000 })
}
