import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { validateAttachment } from '@/lib/validations/attachment'
import { createAttachmentRecord } from '@/server/services/attachment.service'
import crypto from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const attachments = await prisma.attachment.findMany({
      where: { request_id: params.id },
      orderBy: { created_at: 'desc' },
    })

    return successResponse(attachments)
  } catch (error) {
    console.error('GET /api/requests/[id]/attachments error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return errorResponse('VALIDATION_ERROR', 'File non fornito', 400)
    }

    const validation = validateAttachment({
      type: file.type,
      size: file.size,
      name: file.name,
    })

    if (!validation.valid) {
      return errorResponse('VALIDATION_ERROR', validation.error, 400)
    }

    const uuid = crypto.randomUUID()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const relativeUrl = `/uploads/${params.id}/${uuid}-${safeFilename}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', params.id)
    await mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = path.join(uploadDir, `${uuid}-${safeFilename}`)
    await writeFile(filePath, buffer)

    const attachment = await createAttachmentRecord({
      requestId: params.id,
      filename: file.name,
      fileUrl: relativeUrl,
      fileSize: file.size,
      mimeType: file.type,
    })

    return successResponse(attachment)
  } catch (error) {
    console.error('POST /api/requests/[id]/attachments error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel caricamento del file', 500)
  }
}
