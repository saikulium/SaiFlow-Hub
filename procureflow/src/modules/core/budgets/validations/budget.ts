import { z } from 'zod'

export const createBudgetSchema = z.object({
  cost_center: z.string().min(1, 'Centro di costo obbligatorio').max(50),
  department: z.string().max(100).optional(),
  period_type: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
  period_start: z.string().min(1, 'Data inizio obbligatoria'),
  period_end: z.string().min(1, 'Data fine obbligatoria'),
  allocated_amount: z.number().positive('Il plafond deve essere positivo'),
  alert_threshold_percent: z.number().int().min(1).max(100),
  enforcement_mode: z.enum(['SOFT', 'HARD']),
  notes: z.string().max(500).optional(),
})

export const updateBudgetSchema = z.object({
  allocated_amount: z
    .number()
    .positive('Il plafond deve essere positivo')
    .optional(),
  alert_threshold_percent: z.number().int().min(1).max(100).optional(),
  enforcement_mode: z.enum(['SOFT', 'HARD']).optional(),
  notes: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
})

export const budgetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cost_center: z.string().optional(),
  department: z.string().optional(),
  is_active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  period_type: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).optional(),
})

export const budgetCheckSchema = z.object({
  cost_center: z.string().min(1, 'Centro di costo obbligatorio'),
  amount: z.number().positive('Importo deve essere positivo'),
})

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>
export type BudgetCheckInput = z.infer<typeof budgetCheckSchema>
