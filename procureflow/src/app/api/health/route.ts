import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  } catch {
    return errorResponse(
      'DB_CONNECTION_FAILED',
      'Database connection failed',
      503,
    )
  }
}
