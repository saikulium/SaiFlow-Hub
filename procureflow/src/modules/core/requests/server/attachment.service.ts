import { prisma } from '@/lib/db'

interface CreateAttachmentInput {
  readonly requestId: string
  readonly filename: string
  readonly fileUrl: string
  readonly fileSize?: number
  readonly mimeType?: string
}

/**
 * Crea un record allegato per una richiesta d'acquisto.
 *
 * Non gestisce l'upload del file (gestito nella route API).
 * Inserisce il record nel database e crea un evento nella timeline.
 */
export async function createAttachmentRecord(input: CreateAttachmentInput) {
  if (!input.filename.trim()) {
    throw new Error('Il nome del file non puo essere vuoto')
  }

  if (!input.fileUrl.trim()) {
    throw new Error("L'URL del file non puo essere vuoto")
  }

  const attachment = await prisma.attachment.create({
    data: {
      request_id: input.requestId,
      filename: input.filename,
      file_url: input.fileUrl,
      file_size: input.fileSize ?? null,
      mime_type: input.mimeType ?? null,
    },
  })

  await prisma.timelineEvent.create({
    data: {
      request_id: input.requestId,
      type: 'attachment',
      title: 'Allegato aggiunto',
      description: `File "${input.filename}" caricato`,
      actor: null,
    },
  })

  return attachment
}
