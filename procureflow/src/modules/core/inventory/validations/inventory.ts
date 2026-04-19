import { z } from 'zod'

export const createMaterialSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  unit_primary: z.string().min(1, 'UM primaria obbligatoria').max(20),
  unit_secondary: z.string().max(20).optional(),
  conversion_factor: z.number().positive().optional(),
  min_stock_level: z.number().min(0).optional(),
  max_stock_level: z.number().min(0).optional(),
  barcode: z.string().max(100).optional(),
  qr_code: z.string().max(200).optional(),
  preferred_vendor_id: z.string().optional(),
  article_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
})

export const updateMaterialSchema = createMaterialSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const createWarehouseSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  zones: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        name: z.string().min(1).max(200),
      }),
    )
    .optional(),
})

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
  zones: z
    .array(
      z.object({
        id: z.string().optional(),
        code: z.string().min(1).max(20),
        name: z.string().min(1).max(200),
      }),
    )
    .optional(),
})

export const createMovementSchema = z.object({
  material_id: z.string().min(1),
  lot_id: z.string().optional(),
  warehouse_id: z.string().min(1),
  zone_id: z.string().optional(),
  movement_type: z.enum([
    'INBOUND',
    'OUTBOUND',
    'TRANSFER',
    'ADJUSTMENT',
    'RETURN',
  ]),
  reason: z.enum([
    'ACQUISTO',
    'RESO_CLIENTE',
    'PRODUZIONE',
    'TRASFERIMENTO_IN',
    'RETTIFICA_POSITIVA',
    'VENDITA',
    'RESO_FORNITORE',
    'TRASFERIMENTO_OUT',
    'RETTIFICA_NEGATIVA',
    'SCARTO',
    'INVENTARIO',
    'CORREZIONE_MANUALE',
  ]),
  quantity: z.number().positive('Quantità deve essere positiva'),
  quantity_secondary: z.number().positive().optional(),
  unit_cost: z.number().min(0).optional(),
  to_warehouse_id: z.string().optional(),
  to_zone_id: z.string().optional(),
  purchase_request_id: z.string().optional(),
  tender_id: z.string().optional(),
  reference_code: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export const createReservationSchema = z.object({
  material_id: z.string().min(1),
  lot_id: z.string().optional(),
  reserved_quantity: z.number().positive(),
  reserved_quantity_secondary: z.number().positive().optional(),
  tender_id: z.string().optional(),
  purchase_request_id: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateReservationSchema = z.object({
  status: z.enum(['FULFILLED', 'CANCELLED']),
})

export const materialQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  low_stock: z.coerce.boolean().optional(),
  warehouse_id: z.string().optional(),
})

export const movementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  material_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  movement_type: z
    .enum(['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT', 'RETURN'])
    .optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

export const createInventorySchema = z.object({
  warehouse_id: z.string().min(1),
  notes: z.string().max(2000).optional(),
})

export const updateInventoryLineSchema = z.object({
  lines: z.array(
    z.object({
      id: z.string(),
      counted_quantity: z.number().min(0),
    }),
  ),
})

// Export inferred types
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>
export type CreateMovementInput = z.infer<typeof createMovementSchema>
export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>
export type MaterialQueryInput = z.infer<typeof materialQuerySchema>
export type MovementQueryInput = z.infer<typeof movementQuerySchema>
export type CreateInventoryInput = z.infer<typeof createInventorySchema>
export type UpdateInventoryLineInput = z.infer<typeof updateInventoryLineSchema>
