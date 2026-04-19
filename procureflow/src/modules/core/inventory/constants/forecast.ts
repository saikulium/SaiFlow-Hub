// Weighted Moving Average weights (most recent month = highest weight)
export const WMA_WEIGHTS = [3, 2.5, 2, 1.5, 1, 0.5] as const
export const WMA_MONTHS = WMA_WEIGHTS.length

// Projection horizon
export const FORECAST_MONTHS_AHEAD = 3

// AI forecast rate limiting
export const AI_FORECAST_RATE_LIMIT = {
  maxPerUser: 10,
  windowHours: 1,
} as const
