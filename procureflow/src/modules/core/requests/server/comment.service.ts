import { prisma } from '@/lib/db'
import { createNotification, NOTIFICATION_TYPES } from './notification.service'

interface CreateCommentInput {
  readonly requestId: string
  readonly authorId: string
  readonly content: string
  readonly isInternal: boolean
}

const MENTION_REGEX = /@(\w+)/g

/**
 * Crea un commento su una richiesta d'acquisto.
 *
 * - Inserisce il commento nel database
 * - Analizza le @menzioni nel testo
 * - Notifica il proprietario della richiesta (se diverso dall'autore)
 * - Crea un evento nella timeline
 */
export async function createComment(input: CreateCommentInput) {
  const comment = await prisma.comment.create({
    data: {
      request_id: input.requestId,
      author_id: input.authorId,
      content: input.content,
      is_internal: input.isInternal,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  })

  const request = await prisma.purchaseRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    select: { code: true, requester_id: true },
  })

  await notifyMentionedUsers(input.content, input.requestId, request.code)

  await notifyRequestOwner(
    request.requester_id,
    input.authorId,
    input.requestId,
    request.code,
    comment.author.name,
  )

  await prisma.timelineEvent.create({
    data: {
      request_id: input.requestId,
      type: 'comment',
      title: 'Nuovo commento',
      description: `${comment.author.name} ha aggiunto un commento`,
      actor: comment.author.name,
    },
  })

  return comment
}

/**
 * Cerca utenti menzionati nel testo e crea notifiche.
 */
async function notifyMentionedUsers(
  content: string,
  requestId: string,
  requestCode: string,
) {
  const mentions = extractMentions(content)

  if (mentions.length === 0) return

  const mentionedUsers = await prisma.user.findMany({
    where: {
      name: {
        in: mentions.map((m) => m),
        mode: 'insensitive',
      },
    },
    select: { id: true, name: true },
  })

  const notifications = mentionedUsers.map((user) => ({
    userId: user.id,
    title: 'Sei stato menzionato',
    body: `Sei stato menzionato in un commento sulla richiesta ${requestCode}.`,
    type: NOTIFICATION_TYPES.COMMENT_ADDED,
    link: `/requests/${requestId}`,
  }))

  if (notifications.length === 0) return

  await Promise.all(notifications.map(createNotification))
}

async function notifyRequestOwner(
  ownerId: string,
  authorId: string,
  requestId: string,
  requestCode: string,
  authorName: string,
) {
  if (ownerId === authorId) return

  await createNotification({
    userId: ownerId,
    title: 'Nuovo commento sulla tua richiesta',
    body: `${authorName} ha commentato la richiesta ${requestCode}.`,
    type: NOTIFICATION_TYPES.COMMENT_ADDED,
    link: `/requests/${requestId}`,
  })
}

function extractMentions(content: string): readonly string[] {
  const matches = Array.from(content.matchAll(MENTION_REGEX))
  return matches.map((match) => match[1]!)
}
