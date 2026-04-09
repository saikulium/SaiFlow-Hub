import { z } from 'zod'

export const TenderRiskSchema = z.object({
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  mitigation: z.string(),
})

export const TenderAnalysisSchema = z.object({
  fit_score: z.number().min(0).max(100),
  recommendation: z.enum(['GO', 'NO_GO', 'CONDITIONAL_GO']),
  reasoning: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  risks: z.array(TenderRiskSchema),
  estimated_participation_cost: z.number().optional(),
  key_requirements: z.array(z.string()),
  missing_capabilities: z.array(z.string()),
})

export type TenderRisk = z.infer<typeof TenderRiskSchema>
export type TenderAnalysis = z.infer<typeof TenderAnalysisSchema>
