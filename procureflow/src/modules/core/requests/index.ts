// ---------------------------------------------------------------------------
// Requests module — public API
//
// Core procurement requests (Richieste d'Acquisto) + sub-entities:
// approvals, comments, attachments, notifications, timeline.
// ---------------------------------------------------------------------------

// Server — approval workflow
export {
  initiateApprovalWorkflow,
  decideApproval,
  getApprovalThresholds,
  getApprovalTierFromDb,
} from './server/approval.service'

// Server — attachment management
export { createAttachmentRecord } from './server/attachment.service'

// Server — comments
export { createComment } from './server/comment.service'

// Server — order confirmations
export {
  createOrderConfirmation,
  applyConfirmation,
  rejectConfirmation,
  getOrderConfirmation,
  listOrderConfirmations,
  OrderConfirmationNotFoundError,
  InvalidConfirmationStateError,
  InvalidConfirmationLineError,
} from './server/order-confirmation.service'
export type {
  ApplyConfirmationParams,
  RejectConfirmationParams,
  OrderConfirmationWithLines,
} from './server/order-confirmation.service'

// Notifications moved to @/modules/core/notifications (feat/email-notifications).

// Hooks — requests
export { useRequests } from './hooks/use-requests'
export type { RequestListItem, RequestsParams } from './hooks/use-requests'

export {
  useRequest,
  useCreateRequest,
  useUpdateRequest,
  useSubmitRequest,
  useVendors,
  useQuickCreateVendor,
} from './hooks/use-request'
export type {
  RequestItem,
  RequestApproval,
  TimelineEvent,
  RequestComment,
  RequestAttachment,
  PriceVarianceReviewItem,
  PriceVarianceReview,
  RequestDetail,
  Vendor,
} from './hooks/use-request'

// Hooks — approvals
export {
  useMyApprovals,
  useSubmitForApproval,
  useDecideApproval,
} from './hooks/use-approvals'
export type { ApprovalItem, ApprovalRequest } from './hooks/use-approvals'

// Hooks — comments
export { useComments, useCreateComment } from './hooks/use-comments'
export type { Comment, CommentAuthor } from './hooks/use-comments'

// Hooks — attachments
export { useAttachments, useUploadAttachment } from './hooks/use-attachments'
export type { Attachment } from './hooks/use-attachments'

// Notification hooks moved to @/modules/core/notifications.

// Components — pages
export { RequestsPageContent } from './components/requests-page-content'
export { RequestDetailContent } from './components/request-detail-content'

// Components — lists
export { RequestsTable } from './components/requests-table'
export { RequestsKanban } from './components/requests-kanban'
export { RequestFiltersBar } from './components/request-filters'
export type { RequestFilters } from './components/request-filters'

// Components — forms & dialogs
export { RequestForm } from './components/request-form'
export { RequestEditDialog } from './components/request-edit-dialog'

// Components — detail sub-components
export { StatusStepper } from './components/status-stepper'
export { PriceVarianceBanner } from './components/price-variance-banner'
export { ApprovalActions } from './components/approval-actions'

// Components — attachments & comments
export { AttachmentUpload } from './components/attachment-upload'
export { AttachmentPreview } from './components/attachment-preview'
export { CommentForm } from './components/comment-form'

// Components — tabs
export { DettagliTab } from './components/tabs/dettagli-tab'
export { TimelineTab } from './components/tabs/timeline-tab'
export { ApprovazioniTab } from './components/tabs/approvazioni-tab'
export { AllegatiTab } from './components/tabs/allegati-tab'
export { CommentiTab } from './components/tabs/commenti-tab'

// Validations — requests
export {
  requestItemSchema,
  createRequestSchema,
  updateRequestSchema,
  requestQuerySchema,
} from './validations/request'
export type {
  CreateRequestInput,
  UpdateRequestInput,
  RequestQuery,
} from './validations/request'

// Validations — approvals
export {
  approvalDecisionSchema,
  submitForApprovalSchema,
} from './validations/approval'
export type {
  ApprovalDecisionInput,
  SubmitForApprovalInput,
} from './validations/approval'

// Validations — comments
export { createCommentSchema, commentQuerySchema } from './validations/comment'
export type { CreateCommentInput, CommentQuery } from './validations/comment'

// Validations — order confirmations
export {
  orderConfirmationLineSchema,
  orderConfirmationSourceSchema,
  createOrderConfirmationSchema,
  applyConfirmationSchema,
  rejectConfirmationSchema,
} from './validations/order-confirmation'
export type {
  CreateOrderConfirmationInput,
  OrderConfirmationLineInput,
  ApplyConfirmationInput,
  RejectConfirmationInput,
} from './validations/order-confirmation'

// Notification validations moved to @/modules/core/notifications.

// Validations — attachments
export {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILE_SIZE,
  validateAttachment,
} from './validations/attachment'
