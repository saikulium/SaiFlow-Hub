import { withApiHandler } from '@/lib/api-handler'
import { successResponse } from '@/lib/api-response'
import { searchAuditLogs, auditQuerySchema } from '@/modules/core/audit-log'

// TODO: add Redis-backed rate limiting when scaling beyond single instance
export const GET = withApiHandler(
  { auth: ['ADMIN'], querySchema: auditQuerySchema },
  async ({ query }) => {
    const result = await searchAuditLogs(query)
    return successResponse(result)
  },
)
