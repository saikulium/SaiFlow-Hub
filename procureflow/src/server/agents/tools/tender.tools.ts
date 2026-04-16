import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getNextTenderCode } from '@/server/services/tenders.service'
import type { ZodTool } from './procurement.tools'

// ---------------------------------------------------------------------------
// Tender Tools
//
// Mix of write-direct (create_tender, save_tender_analysis) for agent use and
// write-intercepted (update_tender_status, decide_tender_go_nogo) for the
// chat assistant manual loop.
// ---------------------------------------------------------------------------

const placeholderRun = async () =>
  JSON.stringify({ error: 'Write tools require confirmation' })

// ---------------------------------------------------------------------------
// 5.1 create_tender — WRITE-direct (agent only)
// ---------------------------------------------------------------------------

const createTenderInputSchema = z.object({
  title: z.string().describe('Titolo gara'),
  description: z.string().optional(),
  tender_type: z
    .enum([
      'OPEN',
      'RESTRICTED',
      'NEGOTIATED',
      'DIRECT_AWARD',
      'MEPA',
      'FRAMEWORK',
      'PRIVATE',
    ])
    .describe('Tipo procedura'),
  contracting_authority_id: z
    .string()
    .optional()
    .describe('ID del Vendor che funge da ente appaltante'),
  created_by_id: z
    .string()
    .describe('ID dello User creatore della gara (obbligatorio dallo schema)'),
  cig: z.string().optional(),
  cup: z.string().optional(),
  base_amount: z.number().optional(),
  submission_deadline: z.string().optional().describe('ISO 8601 date'),
  category: z.string().optional(),
})

export const createTenderTool = betaZodTool({
  name: 'create_tender',
  description:
    'Crea una nuova gara con codice GARA-YYYY-NNNNN auto-generato. Stato iniziale DISCOVERED.',
  inputSchema: createTenderInputSchema,
  run: async (input) => {
    try {
      const code = await getNextTenderCode()
      const tender = await prisma.tender.create({
        data: {
          code,
          title: input.title,
          description: input.description,
          tender_type: input.tender_type,
          status: 'DISCOVERED',
          contracting_authority_id: input.contracting_authority_id,
          created_by_id: input.created_by_id,
          cig: input.cig,
          cup: input.cup,
          base_amount: input.base_amount,
          submission_deadline: input.submission_deadline
            ? new Date(input.submission_deadline)
            : undefined,
          category: input.category,
          currency: 'EUR',
        },
        select: { id: true, code: true, title: true, status: true },
      })
      return JSON.stringify({ success: true, ...tender })
    } catch (err) {
      return JSON.stringify({
        error: `Errore creazione gara: ${String(err)}`,
      })
    }
  },
})

// ---------------------------------------------------------------------------
// 5.2 get_tender_detail — READ
// ---------------------------------------------------------------------------

const getTenderDetailInputSchema = z
  .object({
    tender_id: z.string().optional(),
    code: z.string().optional(),
  })
  .refine((d) => Boolean(d.tender_id || d.code), {
    message: 'tender_id o code obbligatorio',
  })

export const getTenderDetailTool = betaZodTool({
  name: 'get_tender_detail',
  description:
    'Dettaglio completo di una gara con ente appaltante, timeline recente e documenti.',
  inputSchema: getTenderDetailInputSchema,
  run: async (input) => {
    try {
      const where = input.tender_id
        ? { id: input.tender_id }
        : { code: input.code! }
      const tender = await prisma.tender.findUnique({
        where,
        include: {
          contracting_authority: {
            select: { id: true, name: true, code: true },
          },
          assigned_to: { select: { id: true, name: true } },
          timeline: { orderBy: { created_at: 'desc' }, take: 20 },
          documents: { orderBy: { created_at: 'desc' }, take: 20 },
        },
      })
      if (!tender) return JSON.stringify({ error: 'Gara non trovata' })
      return JSON.stringify(tender)
    } catch (err) {
      return JSON.stringify({
        error: `Errore recupero gara: ${String(err)}`,
      })
    }
  },
})

// ---------------------------------------------------------------------------
// 5.3 update_tender_status — WRITE-intercepted
// ---------------------------------------------------------------------------

const tenderStatusEnum = z.enum([
  'DISCOVERED',
  'EVALUATING',
  'GO',
  'NO_GO',
  'PREPARING',
  'SUBMITTED',
  'UNDER_EVALUATION',
  'WON',
  'LOST',
  'AWARDED',
  'CANCELLED',
  'WITHDRAWN',
])

export const updateTenderStatusTool = betaZodTool({
  name: 'update_tender_status',
  description:
    'Aggiorna lo stato di una gara rispettando la macchina a stati.',
  inputSchema: z.object({
    tender_id: z.string(),
    new_status: tenderStatusEnum,
    notes: z.string().optional(),
  }),
  run: placeholderRun,
})

// ---------------------------------------------------------------------------
// 5.4 decide_tender_go_nogo — WRITE-intercepted
// ---------------------------------------------------------------------------

export const decideTenderGoNogoTool = betaZodTool({
  name: 'decide_tender_go_nogo',
  description:
    'Registra decisione Go/No-Go su una gara con score 0-100 e note.',
  inputSchema: z.object({
    tender_id: z.string(),
    decision: z.enum(['GO', 'NO_GO']),
    score: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  }),
  run: placeholderRun,
})

// ---------------------------------------------------------------------------
// 5.5 save_tender_analysis — WRITE-direct (agent / route-side)
// ---------------------------------------------------------------------------

const saveTenderAnalysisInputSchema = z.object({
  tender_id: z.string(),
  recommendation: z.enum(['GO', 'NO_GO', 'CONDITIONAL_GO']),
  fit_score: z.number().min(0).max(100),
  reasoning: z.string(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  risks: z
    .array(
      z.object({
        description: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
        mitigation: z.string(),
      }),
    )
    .optional(),
  estimated_participation_cost: z.number().optional(),
  key_requirements: z.array(z.string()).optional(),
  missing_capabilities: z.array(z.string()).optional(),
})

export const saveTenderAnalysisTool = betaZodTool({
  name: 'save_tender_analysis',
  description:
    "Persiste il risultato dell'analisi AI su una gara nei campi go_no_go, go_no_go_score, go_no_go_notes. Usato dopo che l'agent tender-analysis completa l'analisi.",
  inputSchema: saveTenderAnalysisInputSchema,
  run: async (input) => {
    const decisionMap = {
      GO: 'GO',
      NO_GO: 'NO_GO',
      CONDITIONAL_GO: 'PENDING',
    } as const
    const goNoGoValue = decisionMap[input.recommendation]

    const serializedNotes = JSON.stringify({
      reasoning: input.reasoning,
      pros: input.pros ?? [],
      cons: input.cons ?? [],
      risks: input.risks ?? [],
      estimated_participation_cost: input.estimated_participation_cost,
      key_requirements: input.key_requirements ?? [],
      missing_capabilities: input.missing_capabilities ?? [],
      analyzed_at: new Date().toISOString(),
    })

    try {
      await prisma.$transaction([
        prisma.tender.update({
          where: { id: input.tender_id },
          data: {
            go_no_go: goNoGoValue,
            go_no_go_score: Math.round(input.fit_score),
            go_no_go_notes: serializedNotes,
            go_no_go_decided_by: 'ai-tender-analyst',
            go_no_go_decided_at: new Date(),
          },
        }),
        prisma.tenderTimeline.create({
          data: {
            tender_id: input.tender_id,
            type: 'ai_analysis',
            title: `Analisi AI: ${input.recommendation} (${Math.round(input.fit_score)}/100)`,
            description: input.reasoning.slice(0, 500),
            metadata: {
              fit_score: input.fit_score,
              recommendation: input.recommendation,
            },
            actor: 'AI Tender Analyst',
          },
        }),
      ])
      return JSON.stringify({
        success: true,
        tender_id: input.tender_id,
        recommendation: input.recommendation,
        fit_score: input.fit_score,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Errore salvataggio analisi: ${String(err)}`,
      })
    }
  },
})

// ---------------------------------------------------------------------------
// Collection export
// ---------------------------------------------------------------------------

export const TENDER_TOOLS = [
  createTenderTool,
  getTenderDetailTool,
  updateTenderStatusTool,
  decideTenderGoNogoTool,
  saveTenderAnalysisTool,
] as readonly ZodTool[]
