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
  processEmailIngestion, enrichWithAgent, type AgentEnrichmentResult,
  // attachment fetcher
  fetchAttachmentBytes, type FetchedAttachment, type FetchAttachmentOptions,
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
  email-intelligence.agent.ts       agent tool-calling multi-step
  email-ai-classifier.service.ts    classificazione intent (Claude)
  email-ingestion.service.ts        ingestion pipeline (upsert PR + notify)
  email-log.service.ts              audit trail in EmailLog
  attachment-fetch.ts               download PDF fail-soft (5s timeout, 10MB cap)
  tools/
    order-confirmation.tools.ts     tool create_order_confirmation (WRITE-direct)
components/
  email-import-dialog.tsx           upload + processing UI
validations/email-ingestion.ts      Zod schema payload webhook
schemas/email-classification.schema.ts   EmailIntent + classification schema
```

## Webhook attachment passthrough

`/api/webhooks/email-ingestion` chiama `processEmailIngestion` (pipeline
strutturata) e, se il payload contiene `attachments[]` con URL PDF, invoca
poi `enrichWithAgent(payload, userId)` come step fail-soft:

1. `fetchAttachmentBytes(url, opts)` scarica ogni URL (solo HTTP/HTTPS,
   solo `application/pdf` via Content-Type + magic bytes `%PDF-`, cap 10MB,
   timeout 5s, max 3 file). Errori → log + `null`.
2. I byte scaricati passano a `processEmail` via Files API: l'agent legge
   il PDF e chiama `create_order_confirmation` per creare una riga
   `OrderConfirmation` strutturata nel modulo `requests`.
3. Qualsiasi errore dell'agent non rompe il webhook — la pipeline
   strutturata ha già scritto la PR.

La policy del workflow n8n per esporre gli URL è documentata in
`docs/internal/n8n-workflow-update-required.md`.

## Dependencies

Core: commesse, requests, articles, vendors, clients, invoicing (via tool-calling),
approvals (approval.service), notifications, comments, attachments,
inventory (STOCK_TOOLS per quantita inventory-aware).
