/** Numero massimo di tentativi di login falliti prima del lockout */
export const MAX_FAILED_ATTEMPTS = 5

/** Durata del lockout in minuti */
export const LOCKOUT_DURATION_MINUTES = 15

/** Durata massima del JWT in secondi (8 ore) */
export const JWT_MAX_AGE_SECONDS = 8 * 60 * 60

/** Durata massima del refresh token in giorni */
export const REFRESH_TOKEN_MAX_AGE_DAYS = 30
