// ---------------------------------------------------------------------------
// AI Feature Types
// ---------------------------------------------------------------------------

// --- Insight Cards (Procurement Intelligence) ---

export interface InsightCard {
  readonly id: string
  readonly type: 'SPEND_ANOMALY' | 'VENDOR_RISK' | 'SAVINGS' | 'BOTTLENECK' | 'BUDGET_ALERT'
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  readonly title: string
  readonly description: string
  readonly actionLabel: string | null
  readonly actionUrl: string | null
  readonly metadata: Record<string, unknown> | null
  readonly dismissed: boolean
  readonly expiresAt: string
  readonly createdAt: string
}

export interface GenerateInsightsResult {
  readonly generated: number
  readonly expired_cleaned: number
  readonly error?: string
}

// --- AI Agent (Action Confirmation) ---

export interface ActionPreview {
  readonly label: string
  readonly fields: ReadonlyArray<{ readonly key: string; readonly value: string }>
}

export interface PendingAction {
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly userId: string
  readonly preview: ActionPreview
  readonly expiresAt: number
}

export type AgentStreamEvent =
  | { readonly type: 'text'; readonly content: string }
  | { readonly type: 'tool_start'; readonly name: string }
  | { readonly type: 'tool_end'; readonly name: string }
  | { readonly type: 'action_request'; readonly actionId: string; readonly tool: string; readonly params: Record<string, unknown>; readonly preview: ActionPreview }
  | { readonly type: 'action_confirmed'; readonly actionId: string; readonly result: unknown }
  | { readonly type: 'action_cancelled'; readonly actionId: string }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly message: string }

// --- Inventory Forecasting ---

export interface BasicForecast {
  readonly materialId: string
  readonly materialName: string
  readonly currentStock: number
  readonly projected: readonly number[]  // next 3 months
  readonly daysRemaining: number
  readonly reorderNeeded: boolean
}

export interface AiForecast extends BasicForecast {
  readonly aiProjected: readonly number[]
  readonly confidence: number  // 0-1
  readonly reasoning: string
  readonly risks: readonly string[]
}

export interface MaterialAlertCard {
  readonly id: string
  readonly materialId: string
  readonly materialName: string
  readonly materialCode: string
  readonly type: 'REORDER_SUGGESTED' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  readonly suggestedQty: number | null
  readonly suggestedVendorId: string | null
  readonly suggestedVendorName: string | null
  readonly daysRemaining: number | null
  readonly dismissed: boolean
  readonly createdAt: string
}

export interface CheckReorderResult {
  readonly alerts_created: number
  readonly alerts_resolved: number
}

// --- Shared Tool Types ---

export type ToolPermissionLevel = 'READ' | 'WRITE'

export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly input_schema: Record<string, unknown>
  readonly permission_level: ToolPermissionLevel
  readonly min_role: 'VIEWER' | 'REQUESTER' | 'MANAGER' | 'ADMIN'
}
