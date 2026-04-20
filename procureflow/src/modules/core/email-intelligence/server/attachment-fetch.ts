// ---------------------------------------------------------------------------
// Attachment fetcher — downloads remote files (PDFs only) for the email agent.
//
// Invariants:
//  - Only `application/pdf` is accepted (enforced by MIME + magic-bytes check).
//  - Request times out after `timeoutMs` (default 5s).
//  - Response body is capped at `maxBytes` (default 10MB).
//  - Fail-soft: on any error returns null + logs a warning. Never throws to
//    the caller, since the email ingestion flow should proceed without the
//    attachment if the download fails.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii')

export interface FetchAttachmentOptions {
  readonly timeoutMs?: number
  readonly maxBytes?: number
  /** Optional filename used only for logging/traceability. */
  readonly filename?: string
}

export interface FetchedAttachment {
  readonly filename: string
  readonly content: Buffer
  readonly mimeType: 'application/pdf'
  readonly sourceUrl: string
}

/**
 * Downloads a remote PDF with safety caps. Returns null on failure (fail-soft).
 */
export async function fetchAttachmentBytes(
  url: string,
  options: FetchAttachmentOptions = {},
): Promise<FetchedAttachment | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const label = options.filename ?? url

  // Basic URL sanity check (reject file://, data:, relative, etc.)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    console.warn(`[attachment-fetch] invalid URL: ${label}`)
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.warn(
      `[attachment-fetch] unsupported protocol ${parsed.protocol} for ${label}`,
    )
    return null
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!response.ok) {
      console.warn(
        `[attachment-fetch] HTTP ${response.status} for ${label}`,
      )
      return null
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .toLowerCase()
      .split(';')[0]
      ?.trim()
    if (contentType && contentType !== 'application/pdf') {
      console.warn(
        `[attachment-fetch] rejected non-PDF content-type "${contentType}" for ${label}`,
      )
      return null
    }

    const contentLengthHeader = response.headers.get('content-length')
    if (contentLengthHeader) {
      const declaredSize = Number.parseInt(contentLengthHeader, 10)
      if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        console.warn(
          `[attachment-fetch] declared size ${declaredSize} exceeds cap ${maxBytes} for ${label}`,
        )
        return null
      }
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength === 0) {
      console.warn(`[attachment-fetch] empty body for ${label}`)
      return null
    }
    if (arrayBuffer.byteLength > maxBytes) {
      console.warn(
        `[attachment-fetch] body size ${arrayBuffer.byteLength} exceeds cap ${maxBytes} for ${label}`,
      )
      return null
    }

    const content = Buffer.from(arrayBuffer)

    // Magic-bytes check — defends against mislabeled non-PDF bodies.
    if (!content.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      console.warn(
        `[attachment-fetch] content does not start with %PDF- for ${label}`,
      )
      return null
    }

    const filename =
      options.filename ?? extractFilenameFromUrl(parsed) ?? 'attachment.pdf'

    return {
      filename,
      content,
      mimeType: 'application/pdf',
      sourceUrl: url,
    }
  } catch (err) {
    const isAbort =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
    if (isAbort) {
      console.warn(
        `[attachment-fetch] timeout after ${timeoutMs}ms for ${label}`,
      )
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[attachment-fetch] fetch failed for ${label}: ${msg}`)
    }
    return null
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function extractFilenameFromUrl(url: URL): string | null {
  const last = url.pathname.split('/').filter(Boolean).pop()
  if (!last) return null
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}
