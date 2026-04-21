import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { ZodTool } from './procurement.tools'

// ---------------------------------------------------------------------------
// Request Status Tools
//
// Tutti questi tool sono WRITE-intercepted: il loro `run` è un placeholder
// che restituisce un errore. L'esecuzione reale avviene in `WRITE_EXECUTORS`
// dentro `procurement.tools.ts` dopo la conferma utente.
// ---------------------------------------------------------------------------

const placeholderRun = async () =>
  JSON.stringify({ error: 'Write tools require confirmation' })

const requestRefSchema = z
  .object({
    request_id: z
      .string()
      .optional()
      .describe('ID della richiesta'),
    code: z
      .string()
      .optional()
      .describe('Codice richiesta (es: PR-2025-00001)'),
  })
  .refine((d) => Boolean(d.request_id || d.code), {
    message: 'request_id o code obbligatorio',
  })

const cancelRequestInputSchema = z
  .object({
    request_id: z.string().optional(),
    code: z.string().optional(),
    reason: z
      .string()
      .optional()
      .describe("Motivo dell'annullamento"),
  })
  .refine((d) => Boolean(d.request_id || d.code), {
    message: 'request_id o code obbligatorio',
  })

export const cancelRequestTool = betaZodTool({
  name: 'cancel_request',
  description:
    "Annulla una richiesta d'acquisto. Ammesso solo da stati attivi (DRAFT, SUBMITTED, PENDING_APPROVAL, APPROVED, ORDERED).",
  inputSchema: cancelRequestInputSchema,
  run: placeholderRun,
})

export const submitForApprovalTool = betaZodTool({
  name: 'submit_for_approval',
  description:
    'Invia una richiesta DRAFT al workflow di approvazione. Applica la policy ruolo+importo.',
  inputSchema: requestRefSchema,
  run: placeholderRun,
})

const rejectRequestInputSchema = z
  .object({
    approval_id: z
      .string()
      .optional()
      .describe("ID dell'approvazione da rifiutare"),
    request_id: z
      .string()
      .optional()
      .describe('ID della richiesta (alternativo ad approval_id)'),
    notes: z.string().optional().describe('Note di rifiuto'),
  })
  .refine((d) => Boolean(d.approval_id || d.request_id), {
    message: 'approval_id o request_id obbligatorio',
  })

export const rejectRequestTool = betaZodTool({
  name: 'reject_request',
  description:
    'Rifiuta una richiesta in PENDING_APPROVAL. Wrapper di decideApproval.',
  inputSchema: rejectRequestInputSchema,
  run: placeholderRun,
})

const putOnHoldInputSchema = z
  .object({
    request_id: z.string().optional(),
    code: z.string().optional(),
    reason: z.string().optional().describe('Motivo della sospensione'),
  })
  .refine((d) => Boolean(d.request_id || d.code), {
    message: 'request_id o code obbligatorio',
  })

export const putRequestOnHoldTool = betaZodTool({
  name: 'put_request_on_hold',
  description: 'Sospende una richiesta attiva portandola in ON_HOLD.',
  inputSchema: putOnHoldInputSchema,
  run: placeholderRun,
})

const resumeRequestInputSchema = z
  .object({
    request_id: z.string().optional(),
    code: z.string().optional(),
    target_status: z
      .enum(['PENDING_APPROVAL', 'ORDERED', 'SHIPPED', 'INVOICED'])
      .describe('Stato target al termine della sospensione'),
  })
  .refine((d) => Boolean(d.request_id || d.code), {
    message: 'request_id o code obbligatorio',
  })

export const resumeRequestTool = betaZodTool({
  name: 'resume_request',
  description:
    'Riprende una richiesta ON_HOLD portandola nel nuovo stato indicato.',
  inputSchema: resumeRequestInputSchema,
  run: placeholderRun,
})

const markOrderedInputSchema = z
  .object({
    request_id: z.string().optional(),
    code: z.string().optional(),
    external_ref: z
      .string()
      .optional()
      .describe('Riferimento ordine fornitore'),
    tracking_number: z.string().optional().describe('Numero tracking'),
  })
  .refine((d) => Boolean(d.request_id || d.code), {
    message: 'request_id o code obbligatorio',
  })

export const markOrderedTool = betaZodTool({
  name: 'mark_ordered',
  description:
    'Marca una richiesta APPROVED come inviata al fornitore (ORDERED).',
  inputSchema: markOrderedInputSchema,
  run: placeholderRun,
})

const markDeliveredInputSchema = z
  .object({
    request_id: z.string().optional(),
    code: z.string().optional(),
    actual_amount: z
      .number()
      .optional()
      .describe('Importo effettivo consegnato'),
    notes: z.string().optional().describe('Note consegna'),
  })
  .refine((d) => Boolean(d.request_id || d.code), {
    message: 'request_id o code obbligatorio',
  })

export const markDeliveredTool = betaZodTool({
  name: 'mark_delivered',
  description:
    'Marca un ordine come consegnato (DELIVERED). Richiede current status SHIPPED.',
  inputSchema: markDeliveredInputSchema,
  run: placeholderRun,
})

export const REQUEST_STATUS_TOOLS = [
  cancelRequestTool,
  submitForApprovalTool,
  rejectRequestTool,
  putRequestOnHoldTool,
  resumeRequestTool,
  markOrderedTool,
  markDeliveredTool,
] as readonly ZodTool[]
