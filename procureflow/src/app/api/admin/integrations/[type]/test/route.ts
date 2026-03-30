import { NextResponse } from 'next/server'
import net from 'net'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { integrationTypeSchema } from '@/lib/validations/admin'

interface RouteParams {
  params: Promise<{ type: string }>
}

interface ImapConfig {
  readonly host: string
  readonly port: number
  readonly protocol: string
  readonly email: string
  readonly password: string
  readonly folder: string
}

interface SdiConfig {
  readonly endpoint_url: string
  readonly codice_destinatario: string
}

interface VendorApiConfig {
  readonly vendor_name: string
  readonly base_url: string
  readonly api_key: string
  readonly custom_headers?: Readonly<Record<string, string>>
}

interface TestResult {
  readonly success: boolean
  readonly message: string
}

function testImapConnection(config: ImapConfig): Promise<TestResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = 5_000

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      socket.destroy()
      resolve({
        success: true,
        message: `Connessione IMAP a ${config.host}:${config.port} riuscita`,
      })
    })

    socket.on('error', (err) => {
      socket.destroy()
      resolve({
        success: false,
        message: `Errore connessione IMAP: ${err.message}`,
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({
        success: false,
        message: `Timeout connessione IMAP a ${config.host}:${config.port}`,
      })
    })

    socket.connect(config.port, config.host)
  })
}

async function testSdiConnection(config: SdiConfig): Promise<TestResult> {
  try {
    const response = await fetch(config.endpoint_url, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })
    const reachable =
      response.ok || response.status === 401 || response.status === 403
    return reachable
      ? {
          success: true,
          message: `Endpoint SDI raggiungibile (HTTP ${response.status})`,
        }
      : {
          success: false,
          message: `Endpoint SDI ha risposto con HTTP ${response.status}`,
        }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Errore connessione SDI: ${msg}` }
  }
}

async function testVendorApiConnection(
  config: VendorApiConfig,
): Promise<TestResult> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.api_key}`,
      ...(config.custom_headers ?? {}),
    }
    const response = await fetch(config.base_url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    const reachable =
      response.ok || response.status === 401 || response.status === 403
    return reachable
      ? {
          success: true,
          message: `API vendor "${config.vendor_name}" raggiungibile (HTTP ${response.status})`,
        }
      : {
          success: false,
          message: `API vendor ha risposto con HTTP ${response.status}`,
        }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Errore connessione API vendor: ${msg}` }
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { type } = await params

  const typeParsed = integrationTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Tipo integrazione non valido: ${type}`,
        },
      },
      { status: 400 },
    )
  }

  const integration = await prisma.integrationConfig.findUnique({
    where: { type: typeParsed.data },
  })

  if (!integration) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Integrazione "${type}" non configurata`,
        },
      },
      { status: 404 },
    )
  }

  let config: Record<string, unknown>
  try {
    config = JSON.parse(decrypt(integration.config)) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DECRYPTION_ERROR',
          message: 'Impossibile decifrare la configurazione',
        },
      },
      { status: 500 },
    )
  }

  const start = Date.now()
  let testResult: TestResult

  switch (typeParsed.data) {
    case 'imap':
      testResult = await testImapConnection(config as unknown as ImapConfig)
      break
    case 'sdi':
      testResult = await testSdiConnection(config as unknown as SdiConfig)
      break
    case 'vendor_api':
      testResult = await testVendorApiConnection(
        config as unknown as VendorApiConfig,
      )
      break
  }

  const latencyMs = Date.now() - start
  const newStatus = testResult.success ? 'connected' : 'error'
  const lastError = testResult.success ? null : testResult.message

  await prisma.integrationConfig.update({
    where: { type: typeParsed.data },
    data: {
      status: newStatus,
      last_error: lastError,
    },
  })

  return NextResponse.json({
    success: true,
    data: Object.freeze({
      success: testResult.success,
      message: testResult.message,
      latency_ms: latencyMs,
    }),
  })
}
