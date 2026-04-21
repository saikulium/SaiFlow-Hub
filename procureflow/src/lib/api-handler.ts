import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { UserRole } from '@prisma/client'
import type { ZodType, ZodError } from 'zod'
import { requireAuth, requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { assertModuleEnabled } from '@/lib/module-guard'
import { errorResponse, validationErrorResponse } from '@/lib/api-response'
import { setAuditContext } from '@/lib/audit-context'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: UserRole
  readonly department: string | null
}

interface HandlerContext<TBody = unknown, TQuery = unknown> {
  readonly req: NextRequest
  readonly user: AuthUser
  readonly params: Record<string, string>
  readonly body: TBody
  readonly query: TQuery
}

type HandlerFn<TBody = unknown, TQuery = unknown> = (
  ctx: HandlerContext<TBody, TQuery>,
) => Promise<NextResponse> | NextResponse

interface ApiHandlerConfig<TBody = unknown, TQuery = unknown> {
  /** Module guard — pathname like '/api/budgets'. If set, checks module is enabled via DB config. */
  readonly module?: string
  /** Pack/env module guard — module name like 'tenders'. If set, checks `ENABLED_MODULES` env var. */
  readonly packModule?: string
  /** Auth requirement. `true` = any authenticated user. Array = role whitelist. */
  readonly auth?: true | readonly UserRole[]
  /** Zod schema for request body (POST/PUT/PATCH). */
  readonly bodySchema?: ZodType<TBody>
  /** Zod schema for URL search params (GET). */
  readonly querySchema?: ZodType<TQuery>
  /** Custom error message for the catch-all handler. */
  readonly errorMessage?: string
  /** Custom error handlers keyed by Prisma error code or Error constructor name. */
  readonly errorHandlers?: Readonly<
    Record<string, (error: unknown) => NextResponse>
  >
}

// ---------------------------------------------------------------------------
// Default error handling
// ---------------------------------------------------------------------------

function handlePrismaP2002(
  error: Prisma.PrismaClientKnownRequestError,
): NextResponse {
  const target = (error.meta?.target as string[]) ?? []
  const field = target.length > 0 ? target.join(', ') : 'campo'
  return errorResponse('DUPLICATE', `Valore duplicato: ${field}`, 409)
}

function handlePrismaP2025(): NextResponse {
  return errorResponse('NOT_FOUND', 'Risorsa non trovata', 404)
}

function handleDefaultError(error: unknown, message: string): NextResponse {
  console.error(`[api-handler] ${message}:`, error)
  return errorResponse('INTERNAL_ERROR', message, 500)
}

// ---------------------------------------------------------------------------
// Route params extraction
// ---------------------------------------------------------------------------

function extractRouteParams(
  args: ReadonlyArray<unknown>,
): Record<string, string> {
  // Next.js 14 calls the route handler as (req, ctx) where ctx = { params }.
  // `args` here is the rest after `req`, so ctx lives at args[0].
  const ctx = args[0] as { params?: Record<string, string> } | undefined
  if (ctx?.params) return ctx.params
  return {}
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

/**
 * Creates a Next.js API route handler with standardized:
 * - Module guard
 * - Authentication / role check
 * - Body & query validation (Zod)
 * - Error handling (Prisma P2002/P2025, custom handlers, catch-all)
 *
 * @example
 * ```ts
 * export const POST = withApiHandler(
 *   { auth: ['ADMIN', 'MANAGER'], bodySchema: createVendorSchema, module: '/api/vendors' },
 *   async ({ body, user }) => {
 *     const vendor = await prisma.vendor.create({ data: body })
 *     return successResponse(vendor)
 *   },
 * )
 * ```
 */
export function withApiHandler<TBody = unknown, TQuery = unknown>(
  config: ApiHandlerConfig<TBody, TQuery>,
  handler: HandlerFn<TBody, TQuery>,
) {
  return async (
    req: NextRequest,
    ...rest: unknown[]
  ): Promise<NextResponse> => {
    // 1a. Pack/env module guard (compile-time pack filter)
    if (config.packModule) {
      const packGate = assertModuleEnabled(config.packModule)
      if (packGate) return packGate
    }

    // 1b. DB module guard (runtime toggle)
    if (config.module) {
      const blocked = await requireModule(config.module)
      if (blocked) return blocked
    }

    try {
      // 2. Authentication
      let user: AuthUser | undefined
      if (config.auth) {
        const authResult =
          config.auth === true
            ? await requireAuth()
            : await requireRole(...(config.auth as UserRole[]))

        if (authResult instanceof NextResponse) return authResult
        user = authResult as AuthUser
      }

      // 3. Route params
      const params = extractRouteParams(rest)

      // 4. Body validation
      let body: TBody = undefined as TBody
      if (config.bodySchema) {
        let rawBody: unknown
        try {
          rawBody = await req.json()
        } catch {
          return errorResponse(
            'INVALID_BODY',
            'Corpo della richiesta non valido',
            400,
          )
        }
        const parsed = config.bodySchema.safeParse(rawBody)
        if (!parsed.success) {
          return validationErrorResponse((parsed.error as ZodError).flatten())
        }
        body = parsed.data
      }

      // 5. Query validation
      let query: TQuery = undefined as TQuery
      if (config.querySchema) {
        const raw = Object.fromEntries(req.nextUrl.searchParams)
        const parsed = config.querySchema.safeParse(raw)
        if (!parsed.success) {
          return validationErrorResponse((parsed.error as ZodError).flatten())
        }
        query = parsed.data
      }

      // 6. Execute handler — wrapped in audit context when user is present
      const execute = () =>
        Promise.resolve(
          handler({
            req,
            user: user as AuthUser,
            params,
            body,
            query,
          }),
        )

      if (user) {
        const ipAddress =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          undefined
        return await setAuditContext(
          {
            actorId: user.id,
            actorType: 'USER',
            actorLabel: user.email,
            ipAddress,
            userAgent: req.headers.get('user-agent') ?? undefined,
          },
          execute,
        )
      }
      return await execute()
    } catch (error) {
      // Custom error handlers
      if (config.errorHandlers) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          config.errorHandlers[error.code]
        ) {
          return config.errorHandlers[error.code]!(error)
        }
        const name = error instanceof Error ? error.constructor.name : ''
        if (name && config.errorHandlers[name]) {
          return config.errorHandlers[name]!(error)
        }
      }

      // Built-in Prisma error handling
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return handlePrismaP2002(error)
        if (error.code === 'P2025') return handlePrismaP2025()
      }

      // Catch-all
      const message = config.errorMessage ?? 'Errore interno del server'
      return handleDefaultError(error, message)
    }
  }
}
