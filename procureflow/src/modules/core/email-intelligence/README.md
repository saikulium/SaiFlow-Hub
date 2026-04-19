# Email Intelligence Module

Pack: `core` · Path: `@/modules/core/email-intelligence`

Pipeline di classificazione e processing automatico delle email commerciali
(ORDINE_CLIENTE, CONFERMA_ORDINE, RITARDO_CONSEGNA, VARIAZIONE_PREZZO,
RICHIESTA_INFO, FATTURA_ALLEGATA, ALTRO) con agent Claude tool-calling.

## Public API

```typescript
import {
  // agent
  processEmail, type EmailProcessingResult, type EmailAttachmentFile,
  // classifier
  classifyEmailIntent, mapClassificationToPayload,
  EmailClassificationError, type RawEmailData,
  // ingestion pipeline
  processEmailIngestion,
  // audit log
  createEmailLog, getEmailLogs, getEmailLogsByRequest, getPendingDecisions,
  // schemas/validations
  emailIngestionSchema, EmailClassificationSchema, EMAIL_INTENTS,
  type EmailIntent, type EmailClassification, type EmailIngestionPayload,
  // UI
  EmailImportDialog,
} from '@/modules/core/email-intelligence'
```

## Struttura

```
server/
  email-intelligence.agent.ts  agent tool-calling multi-step
  email-ai-classifier.service.ts   classificazione intent (Claude)
  email-ingestion.service.ts   ingestion pipeline (upsert PR + notify)
  email-log.service.ts         audit trail in EmailLog
components/
  email-import-dialog.tsx      upload + processing UI
validations/email-ingestion.ts Zod schema payload webhook
schemas/email-classification.schema.ts   EmailIntent + classification schema
```

## Dependencies

Core: commesse, requests, articles, vendors, clients, invoicing (via tool-calling),
approvals (approval.service), notifications, comments, attachments,
inventory (STOCK_TOOLS per quantita inventory-aware).
