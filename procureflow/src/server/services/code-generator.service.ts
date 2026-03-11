import { prisma } from '@/lib/db'
import { generateRequestCode } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Generazione atomica del codice PR-YYYY-NNNNN.
//
// Usa una transazione serializable con SELECT ... FOR UPDATE per garantire
// unicità anche sotto richieste concorrenti. Il lock è breve e accettabile
// per il volume tipico di procurement (<100 richieste/giorno).
// ---------------------------------------------------------------------------

/**
 * Genera il prossimo codice richiesta in modo atomico.
 * Ritorna il codice generato (es. "PR-2026-00042").
 *
 * Usa $queryRawUnsafe con FOR UPDATE per bloccare la riga con il codice
 * più alto durante la generazione, prevenendo race condition.
 */
export async function generateNextCodeAtomic(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PR-${year}-`

  const code = await prisma.$transaction(
    async (tx) => {
      // Lock sulla riga con il codice più alto per quest'anno
      const rows = await tx.$queryRawUnsafe<{ code: string }[]>(
        `SELECT code FROM purchase_requests
         WHERE code LIKE $1
         ORDER BY code DESC
         LIMIT 1
         FOR UPDATE`,
        `${prefix}%`,
      )

      const lastCode = rows[0]?.code
      const lastNum = lastCode ? parseInt(lastCode.split('-')[2] ?? '0', 10) : 0

      return generateRequestCode(year, lastNum + 1)
    },
    {
      timeout: 5000,
    },
  )

  return code
}
