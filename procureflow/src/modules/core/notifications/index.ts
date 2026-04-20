// ---------------------------------------------------------------------------
// Notifications module — public API
//
// Sistema notifiche multi-canale (in-app + email + digest).
// ---------------------------------------------------------------------------

// Server — notifiche
export {
  NOTIFICATION_TYPES,
  createNotification,
  createBulkNotifications,
} from './server/notification.service'
export type { NotificationType } from './server/notification.service'

// Types
export {
  NOTIFICATION_TYPE_KEYS,
  type NotificationTypeKey,
  type NotificationChannel,
  type CreateNotificationInput,
} from './server/notification.types'

// Email transport
export {
  type EmailMessage,
  type EmailTransport,
  type EmailSendResult,
  NoopTransport,
  ResendTransport,
  getEmailTransport,
  __setTransportForTest,
  __resetTransport,
} from './server/email-transport'
export { EMAIL_CONFIG } from './server/email-config'

// Preferences
export {
  getUserPreferences,
  updateUserPreferences,
  type UpdatePreferencesInput,
} from './server/preference.service'
export {
  resolveChannels,
  isInQuietHours,
  isUrgent,
  URGENT_TYPES,
  getDefaultChannels,
} from './server/channel-resolver'

// Hooks — client
export {
  useNotifications,
  useMarkAsRead,
  useMarkSingleRead,
} from './hooks/use-notifications'
export type { NotificationItem } from './hooks/use-notifications'

// Validations — API
export {
  notificationQuerySchema,
  markReadSchema,
} from './validations/notification'
export type {
  NotificationQuery,
  MarkReadInput,
} from './validations/notification'
export { updatePreferencesSchema } from './validations/preference'
export type { UpdatePreferencesPayload } from './validations/preference'
