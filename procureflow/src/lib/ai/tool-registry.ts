import type { ToolDefinition } from '@/types/ai'

export type UserRole = 'VIEWER' | 'REQUESTER' | 'MANAGER' | 'ADMIN'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 0,
  REQUESTER: 1,
  MANAGER: 2,
  ADMIN: 3,
}

export const READ_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'search_requests',
    description: 'Cerca richieste di acquisto (Purchase Requests). Usa per domande su richieste, ordini, stato ordini, spese.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ORDERED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ON_HOLD', 'INVOICED', 'RECONCILED', 'CLOSED'],
          description: 'Filtra per stato',
        },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], description: 'Filtra per priorità' },
        search: { type: 'string', description: 'Ricerca testo libero su codice o titolo' },
        pageSize: { type: 'number', description: 'Numero massimo di risultati (default 10, max 20)' },
      },
    },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'get_request_detail',
    description: 'Ottieni dettaglio completo di una singola richiesta per codice (es: PR-2025-00001). Include items, fornitore, timeline.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Codice richiesta (formato PR-YYYY-NNNNN)' },
      },
      required: ['code'],
    },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'search_vendors',
    description: 'Cerca fornitori per nome, stato, o categoria. Usa per domande su fornitori, chi fornisce cosa.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Ricerca per nome fornitore' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING_REVIEW'], description: 'Filtra per stato fornitore' },
        pageSize: { type: 'number', description: 'Numero massimo di risultati (default 10, max 20)' },
      },
    },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'get_budget_overview',
    description: 'Ottieni panoramica budget per centro di costo o dipartimento. Mostra allocato, speso, impegnato, disponibile.',
    input_schema: {
      type: 'object',
      properties: {
        cost_center: { type: 'string', description: 'Filtra per centro di costo' },
        department: { type: 'string', description: 'Filtra per dipartimento' },
        is_active: { type: 'boolean', description: 'Solo budget attivi (default true)' },
      },
    },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'get_invoice_stats',
    description: 'Statistiche fatture: totali, non matchate, in riconciliazione, contestate, importi.',
    input_schema: { type: 'object', properties: {} },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'search_invoices',
    description: 'Cerca fatture con filtri. Usa per domande su fatture specifiche, per fornitore, per stato.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Ricerca per numero fattura o fornitore' },
        match_status: { type: 'string', enum: ['UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'SUGGESTED'], description: 'Filtra per stato di matching' },
        reconciliation_status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DISPUTED', 'REJECTED'], description: 'Filtra per stato riconciliazione' },
        pageSize: { type: 'number', description: 'Numero massimo di risultati (default 10, max 20)' },
      },
    },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'get_inventory_stats',
    description: 'Statistiche magazzino: materiali totali, valore, scorte basse, movimenti recenti.',
    input_schema: { type: 'object', properties: {} },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  {
    name: 'get_tender_stats',
    description: 'Statistiche gare: attive, valore pipeline, scadenze imminenti, tasso di vittoria.',
    input_schema: { type: 'object', properties: {} },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
] as const

export const WRITE_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'create_request',
    description: 'Crea una nuova richiesta d\'acquisto.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titolo della richiesta' },
        description: { type: 'string', description: 'Descrizione dettagliata' },
        vendor_id: { type: 'string', description: 'ID del fornitore' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        needed_by: { type: 'string', description: 'Data necessità (ISO 8601)' },
        category: { type: 'string' },
        department: { type: 'string' },
        cost_center: { type: 'string' },
        budget_code: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string' },
              unit_price: { type: 'number' },
            },
            required: ['name', 'quantity'],
          },
        },
      },
      required: ['title'],
    },
    permission_level: 'WRITE',
    min_role: 'REQUESTER',
  },
  {
    name: 'update_request',
    description: 'Aggiorna una richiesta d\'acquisto propria (titolo, descrizione, priorità, data necessità, fornitore, categoria).',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'ID della richiesta' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        needed_by: { type: 'string' },
        vendor_id: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['request_id'],
    },
    permission_level: 'WRITE',
    min_role: 'REQUESTER',
  },
  {
    name: 'submit_for_approval',
    description: 'Invia una richiesta per approvazione.',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'ID della richiesta da inviare' },
      },
      required: ['request_id'],
    },
    permission_level: 'WRITE',
    min_role: 'REQUESTER',
  },
  {
    name: 'approve_request',
    description: 'Approva una richiesta in attesa di approvazione.',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'ID della richiesta da approvare' },
        notes: { type: 'string', description: 'Note di approvazione opzionali' },
      },
      required: ['request_id'],
    },
    permission_level: 'WRITE',
    min_role: 'MANAGER',
  },
  {
    name: 'create_vendor',
    description: 'Crea un nuovo fornitore.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome del fornitore' },
        code: { type: 'string', description: 'Codice fornitore univoco' },
        email: { type: 'string' },
        phone: { type: 'string' },
        category: { type: 'array', items: { type: 'string' } },
        payment_terms: { type: 'string' },
      },
      required: ['name', 'code'],
    },
    permission_level: 'WRITE',
    min_role: 'MANAGER',
  },
  {
    name: 'bulk_update',
    description: 'Aggiornamento massivo di richieste (max 50, solo priorità/categoria/dipartimento).',
    input_schema: {
      type: 'object',
      properties: {
        request_ids: { type: 'array', items: { type: 'string' }, maxItems: 50 },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        category: { type: 'string' },
        department: { type: 'string' },
      },
      required: ['request_ids'],
    },
    permission_level: 'WRITE',
    min_role: 'ADMIN',
  },
] as const

export function getToolsForRole(role: UserRole): readonly ToolDefinition[] {
  const roleLevel = ROLE_HIERARCHY[role]
  return [...READ_TOOLS, ...WRITE_TOOLS].filter(
    (tool) => ROLE_HIERARCHY[tool.min_role] <= roleLevel,
  )
}

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.some((t) => t.name === toolName)
}
