import { z } from 'zod'

export const approvalDecisionSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(2000).optional(),
})

export const submitForApprovalSchema = z.object({
  request_id: z.string().min(1),
})

export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>
export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>
