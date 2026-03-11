import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Utilità condivise per l'autenticazione webhook (HMAC + Bearer)
// ---------------------------------------------------------------------------

/**
 * Verifica la firma HMAC-SHA256 di un payload.
 * Usa timingSafeEqual per prevenire timing attacks.
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
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
 */
export function verifyWebhookAuth(
  rawBody: string,
  signatureHeader: string | null,
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false

  const signature = signatureHeader ?? ''
  const bearerToken = extractBearerToken(authorizationHeader)

  const isHmacValid =
    signature !== '' && verifyHmacSignature(rawBody, signature, secret)
  const isBearerValid = bearerToken !== '' && bearerToken === secret

  return isHmacValid || isBearerValid
}
