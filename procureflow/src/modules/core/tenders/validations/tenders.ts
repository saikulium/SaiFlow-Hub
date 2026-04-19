import { z } from 'zod'

export const createTenderSchema = z.object({
  title: z.string().min(1, 'Titolo obbligatorio').max(200),
  description: z.string().max(5000).optional(),
  tender_type: z.enum([
    'OPEN',
    'RESTRICTED',
    'NEGOTIATED',
    'DIRECT_AWARD',
    'MEPA',
    'FRAMEWORK',
    'PRIVATE',
  ]),
  contracting_authority_id: z.string().optional(),
  cig: z.string().max(10).optional(),
  cup: z.string().max(15).optional(),
  gara_number: z.string().max(50).optional(),
  lotto_number: z.string().max(20).optional(),
  platform_url: z.string().url().optional().or(z.literal('')),
  anac_id: z.string().max(50).optional(),
  base_amount: z.number().positive().optional(),
  publication_date: z.string().optional(),
  question_deadline: z.string().optional(),
  submission_deadline: z.string().optional(),
  opening_date: z.string().optional(),
  award_criteria: z.string().optional(),
  technical_weight: z.number().int().min(0).max(100).optional(),
  economic_weight: z.number().int().min(0).max(100).optional(),
  category: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  cost_center: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  assigned_to_id: z.string().optional(),
  notes: z.string().max(5000).optional(),
})

export const updateTenderSchema = createTenderSchema.partial().extend({
  our_offer_amount: z.number().positive().optional(),
  awarded_amount: z.number().positive().optional(),
  our_technical_score: z.number().min(0).max(100).optional(),
  our_economic_score: z.number().min(0).max(100).optional(),
  our_total_score: z.number().min(0).max(100).optional(),
  winner_name: z.string().max(200).optional(),
  winner_amount: z.number().positive().optional(),
  participants_count: z.number().int().min(0).optional(),
  contract_start_date: z.string().optional(),
  contract_end_date: z.string().optional(),
})

export const tenderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(), // comma-separated statuses
  tender_type: z.string().optional(),
  assigned_to: z.string().optional(),
  contracting_authority_id: z.string().optional(),
  deadline_from: z.string().optional(),
  deadline_to: z.string().optional(),
})

export const goNoGoSchema = z.object({
  decision: z.enum(['GO', 'NO_GO']),
  scores: z.object({
    margin: z.number().int().min(0).max(25),
    technical: z.number().int().min(0).max(25),
    experience: z.number().int().min(0).max(15),
    risk: z.number().int().min(0).max(15),
    workload: z.number().int().min(0).max(10),
    strategic: z.number().int().min(0).max(10),
  }),
  notes: z.string().max(5000).optional(),
})

export const statusTransitionSchema = z.object({
  status: z.enum([
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
  ]),
  notes: z.string().max(2000).optional(),
})

// Export inferred types
export type CreateTenderInput = z.infer<typeof createTenderSchema>
export type UpdateTenderInput = z.infer<typeof updateTenderSchema>
export type GoNoGoInput = z.infer<typeof goNoGoSchema>
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>
