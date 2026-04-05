import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z
    .string()
    .min(1, 'Password obbligatoria')
    .max(72, 'Password troppo lunga'),
})

/** Password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 number */
export const passwordSchema = z
  .string()
  .min(8, 'Minimo 8 caratteri')
  .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
  .regex(/[a-z]/, 'Almeno una lettera minuscola')
  .regex(/[0-9]/, 'Almeno un numero')

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  email: z.string().email('Email non valida'),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'MANAGER', 'REQUESTER', 'VIEWER']),
  department: z.string().optional(),
})

export const updateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'REQUESTER', 'VIEWER']),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
