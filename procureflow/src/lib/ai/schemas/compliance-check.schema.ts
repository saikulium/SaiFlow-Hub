import { z } from 'zod'

export const ComplianceAlertSchema = z.object({
  category: z.enum([
    'ORDER_OVERDUE',
    'BUDGET_OVERRUN',
    'INVOICE_UNRECONCILED',
    'APPROVAL_STALE',
  ]),
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string(),
  description: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  action_label: z.string().optional(),
  action_url: z.string().optional(),
})

export type ComplianceAlert = z.infer<typeof ComplianceAlertSchema>
