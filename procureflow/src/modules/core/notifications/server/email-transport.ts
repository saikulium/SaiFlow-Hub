// ---------------------------------------------------------------------------
// Email transport abstraction
//
// Interfaccia EmailTransport + due implementazioni:
//  - ResendTransport: invio reale via API Resend (prod/dev con API key).
//  - NoopTransport: accumula le email in memoria, usato in test per
//    asserzioni deterministiche.
//
// La factory getEmailTransport() sceglie l'implementazione in base a
// NODE_ENV / presenza RESEND_API_KEY. __setTransportForTest() consente
// iniezione in test suite (bypassando la factory cache).
// ---------------------------------------------------------------------------

import { Resend } from 'resend'
import { EMAIL_CONFIG } from './email-config'

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  /** Tag opzionali per tracking/analytics (notification_id, type, ecc.) */
  tags?: Record<string, string>
}

export interface EmailSendResult {
  id: string
  success: boolean
  error?: string
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>
}

// ---------------------------------------------------------------------------
// ResendTransport — production implementation
// ---------------------------------------------------------------------------

export class ResendTransport implements EmailTransport {
  private readonly client: Resend

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ResendTransport: apiKey is required')
    }
    this.client = new Resend(apiKey)
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const tags = message.tags
      ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
      : undefined

    try {
      const response = await this.client.emails.send({
        from: message.from ?? EMAIL_CONFIG.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo ?? EMAIL_CONFIG.replyTo,
        tags,
      })

      if (response.error) {
        return {
          id: '',
          success: false,
          error: response.error.message ?? 'Unknown Resend error',
        }
      }

      return {
        id: response.data?.id ?? '',
        success: true,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { id: '', success: false, error }
    }
  }
}

// ---------------------------------------------------------------------------
// NoopTransport — test spy (accumulates messages in memory)
// ---------------------------------------------------------------------------

export class NoopTransport implements EmailTransport {
  public readonly sent: EmailMessage[] = []

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message)
    return {
      id: `noop-${Date.now()}-${this.sent.length}`,
      success: true,
    }
  }

  reset(): void {
    this.sent.length = 0
  }
}

// ---------------------------------------------------------------------------
// Factory + test injection
// ---------------------------------------------------------------------------

let transportInstance: EmailTransport | null = null

export function getEmailTransport(): EmailTransport {
  if (transportInstance) return transportInstance

  const apiKey = process.env.RESEND_API_KEY
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest || !apiKey) {
    transportInstance = new NoopTransport()
  } else {
    transportInstance = new ResendTransport(apiKey)
  }

  return transportInstance
}

/**
 * Sostituisce l'istanza singleton con un transport fornito dal test.
 * Da usare solo in test. Chiama `__resetTransport()` al teardown.
 */
export function __setTransportForTest(transport: EmailTransport): void {
  transportInstance = transport
}

/**
 * Resetta la factory cache. Utile fra test case.
 */
export function __resetTransport(): void {
  transportInstance = null
}
