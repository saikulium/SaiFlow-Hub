import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validazione CIG / CUP — identificativi obbligatori per procurement pubblico
// ---------------------------------------------------------------------------

/** CIG: Codice Identificativo Gara — 10 caratteri alfanumerici */
export const cigSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{10}$/, 'CIG deve essere di 10 caratteri alfanumerici')
  .transform((v) => v.toUpperCase())

/** CUP: Codice Unico Progetto — 15 caratteri alfanumerici */
export const cupSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9]{15}$/,
    'CUP deve essere di 15 caratteri alfanumerici',
  )
  .transform((v) => v.toUpperCase())

/** Partita IVA italiana — 11 cifre con check digit */
export const italianVatIdSchema = z
  .string()
  .regex(/^\d{11}$/, 'Partita IVA deve essere di 11 cifre')
  .refine(validateItalianVatChecksum, 'Partita IVA non valida (checksum)')

/** Validazione CIG (standalone) */
export function validateCig(value: string): boolean {
  return /^[A-Za-z0-9]{10}$/.test(value)
}

/** Validazione CUP (standalone) */
export function validateCup(value: string): boolean {
  return /^[A-Za-z0-9]{15}$/.test(value)
}

/**
 * Validazione checksum Partita IVA italiana (algoritmo Luhn variante).
 * Riferimento: DM 23/12/1976
 */
export function validateItalianVatChecksum(vatId: string): boolean {
  if (!/^\d{11}$/.test(vatId)) return false

  const digits = vatId.split('').map(Number)

  let sumOdd = 0
  let sumEven = 0

  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      // Posizioni dispari (1-based: 1,3,5,7,9)
      sumOdd += digits[i]!
    } else {
      // Posizioni pari (1-based: 2,4,6,8,10)
      const doubled = digits[i]! * 2
      sumEven += doubled > 9 ? doubled - 9 : doubled
    }
  }

  const checkDigit = (10 - ((sumOdd + sumEven) % 10)) % 10
  return checkDigit === digits[10]
}
