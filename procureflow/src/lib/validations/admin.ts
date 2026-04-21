import { z } from 'zod'

export const updateConfigSchema = z.object({
  deploy_name: z.string().min(1).max(100).optional(),
  company_logo_url: z.string().max(500_000).nullable().optional(),
  enabled_modules: z.array(z.string()).optional(),
  categories: z.array(z.string().min(1).max(100)).optional(),
  departments: z.array(z.string().min(1).max(100)).optional(),
  cost_centers: z.array(z.string().min(1).max(100)).optional(),
  approval_rules: z
    .object({
      autoApproveMax: z.number().min(0).max(1_000_000),
      managerApproveMax: z.number().min(0).max(10_000_000),
    })
    .optional(),
})

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>

const imapConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(['imap', 'imaps']),
  email: z.string().email(),
  password: z.string().min(1),
  folder: z.string().default('INBOX'),
})

const sdiConfigSchema = z.object({
  endpoint_url: z.string().url(),
  codice_destinatario: z.string().min(1).max(7),
  certificate_base64: z.string().optional(),
  certificate_password: z.string().optional(),
})

const vendorApiConfigSchema = z.object({
  vendor_name: z.string().min(1),
  base_url: z.string().url(),
  api_key: z.string().min(1),
  custom_headers: z.record(z.string(), z.string()).optional(),
})

export const integrationTypeSchema = z.enum(['imap', 'sdi', 'vendor_api'])

export const upsertIntegrationSchema = z.object({
  label: z.string().min(1).max(100),
  enabled: z.boolean(),
  config: z.union([imapConfigSchema, sdiConfigSchema, vendorApiConfigSchema]),
})

export type IntegrationType = z.infer<typeof integrationTypeSchema>
export type UpsertIntegrationInput = z.infer<typeof upsertIntegrationSchema>
