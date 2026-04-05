import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Costanti
// ---------------------------------------------------------------------------

/** Tolleranza timestamp: 5 minuti (300 secondi) */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300

/** Dimensione massima body webhook: 10 MB */
export const MAX_WEBHOOK_BODY_BYTES = 10 * 1024 * 1024

// ---------------------------------------------------------------------------
// Utilità condivise per l'autenticazione webhook (HMAC + Bearer + Timestamp)
// ---------------------------------------------------------------------------

/**
 * Verifica che il timestamp del webhook sia entro la tolleranza.
 * Previene replay attack rifiutando payload più vecchi di 5 minuti.
 */
export function verifyTimestamp(timestampHeader: string | null): {
  valid: boolean
  reason?: string
} {
  if (!timestampHeader) {
    return { valid: false, reason: 'MISSING_TIMESTAMP' }
  }

  const timestamp = Number(timestampHeader)
  if (Number.isNaN(timestamp)) {
    return { valid: false, reason: 'INVALID_TIMESTAMP' }
  }

  const now = Math.floor(Date.now() / 1000)
  const diff = Math.abs(now - timestamp)

  if (diff > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, reason: 'TIMESTAMP_EXPIRED' }
  }

  return { valid: true }
}

/**
 * Verifica la firma HMAC-SHA256 di un payload.
 * Usa timingSafeEqual per prevenire timing attacks.
 *
 * Se `timestamp` è fornito, il payload firmato diventa `${timestamp}.${payload}`.
 * Questo lega il timestamp alla firma, impedendo di separare i due valori.
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp?: string,
): boolean {
  if (!secret || !signature) return false

  const signedPayload = timestamp ? `${timestamp}.${payload}` : payload

  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  if (signature.length !== expected.length) return false

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

/**
 * Estrae il Bearer token dall'header Authorization.
 */
export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader) return ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
}

/**
 * Verifica autenticazione webhook: HMAC signature OPPURE Bearer token.
 * Ritorna true se almeno uno dei metodi è valido.
 *
 * Se `timestampHeader` è presente:
 *   1. Verifica che il timestamp sia entro la tolleranza (5 min)
 *   2. Include il timestamp nel calcolo HMAC
 *
 * Se `timestampHeader` è assente:
 *   Backward-compatible — verifica HMAC senza timestamp (con warning in console).
 */
export function verifyWebhookAuth(
  rawBody: string,
  signatureHeader: string | null,
  authorizationHeader: string | null,
  secret: string | undefined,
  timestampHeader?: string | null,
): boolean {
  if (!secret) return false

  // Body size check
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    console.warn(
      `[webhook-auth] Body troppo grande: ${rawBody.length} bytes (max ${MAX_WEBHOOK_BODY_BYTES})`,
    )
    return false
  }

  // Timestamp validation (obbligatorio)
  if (!timestampHeader) {
    console.warn(
      '[webhook-auth] Header x-webhook-timestamp mancante — richiesta rifiutata',
    )
    return false
  }
  const tsCheck = verifyTimestamp(timestampHeader)
  if (!tsCheck.valid) {
    console.warn(
      `[webhook-auth] Timestamp rifiutato: ${tsCheck.reason} (header: ${timestampHeader})`,
    )
    return false
  }

  const signature = signatureHeader ?? ''
  const bearerToken = extractBearerToken(authorizationHeader)

  const isHmacValid =
    signature !== '' &&
    verifyHmacSignature(
      rawBody,
      signature,
      secret,
      timestampHeader ?? undefined,
    )

  const isBearerValid = bearerToken !== '' && bearerToken === secret

  return isHmacValid || isBearerValid
}
