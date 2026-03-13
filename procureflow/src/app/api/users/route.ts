import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { createUserSchema } from '@/lib/validations/auth'

export async function GET() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  })

  return successResponse(users)
}

export async function POST(request: NextRequest) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.flatten().fieldErrors)
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return errorResponse('DUPLICATE_EMAIL', 'Email già registrata', 409)
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash,
      role: parsed.data.role,
      department: parsed.data.department ?? null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      created_at: true,
    },
  })

  return successResponse(user)
}
