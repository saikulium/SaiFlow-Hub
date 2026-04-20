// ---------------------------------------------------------------------------
// Notifications module — public API
//
// Sistema notifiche multi-canale (in-app oggi, email + digest in arrivo).
// Migrato da requests/ in feat/email-notifications.
// ---------------------------------------------------------------------------

// Server — notifiche
export {
  NOTIFICATION_TYPES,
  createNotification,
  createBulkNotifications,
} from './server/notification.service'
export type { NotificationType } from './server/notification.service'

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
