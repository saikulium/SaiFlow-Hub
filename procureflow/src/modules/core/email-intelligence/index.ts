// ---------------------------------------------------------------------------
// Email Intelligence Module — barrel export
// ---------------------------------------------------------------------------

// Server — agent
export { processEmail } from './server/email-intelligence.agent'
export type {
  EmailAttachmentFile,
  EmailProcessingResult,
} from './server/email-intelligence.agent'

// Server — classifier
export {
  classifyEmailIntent,
  mapClassificationToPayload,
  mapParsedToClassification,
  mapAiResponseToClassification,
  EmailClassificationError,
} from './server/email-ai-classifier.service'
export type {
  RawEmailData,
  EmailIntent as ClassifierEmailIntent,
  ClassificationResult,
} from './server/email-ai-classifier.service'

// Server — ingestion
export { processEmailIngestion } from './server/email-ingestion.service'

// Server — log
export {
  createEmailLog,
  getEmailLogs,
  getEmailLogsByRequest,
  getPendingDecisions,
} from './server/email-log.service'

// Validations
export { emailIngestionSchema } from './validations/email-ingestion'
export type {
  EmailIngestionPayload,
  EmailItem,
  ActionType,
} from './validations/email-ingestion'

// Schemas
export {
  EMAIL_INTENTS,
  EmailClassificationSchema,
} from './schemas/email-classification.schema'
export type {
  EmailIntent,
  EmailClassification,
} from './schemas/email-classification.schema'

// Components
export { EmailImportDialog } from './components/email-import-dialog'
