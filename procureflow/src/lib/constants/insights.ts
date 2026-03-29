// Default TTL per insight type in hours
export const INSIGHT_TTL_HOURS = {
  SPEND_ANOMALY: 72,
  VENDOR_RISK: 72,
  SAVINGS: 168,    // 1 week
  BOTTLENECK: 48,
  BUDGET_ALERT: 336, // 2 weeks
} as const

export const INSIGHT_SEVERITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const

export const MAX_ACTIVE_INSIGHTS = 6
