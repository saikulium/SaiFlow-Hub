import { NextResponse } from 'next/server'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    total: number
    page: number
    pageSize: number
  }
}

export function successResponse<T>(data: T, meta?: ApiResponse<T>['meta']) {
  const body: ApiResponse<T> = { success: true, data }
  if (meta) body.meta = meta
  return NextResponse.json(body)
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json(
    { success: false, error: { code, message, details } } satisfies ApiResponse<never>,
    { status },
  )
}

export function notFoundResponse(message = 'Risorsa non trovata') {
  return errorResponse('NOT_FOUND', message, 404)
}

export function validationErrorResponse(details: unknown) {
  return errorResponse('VALIDATION_ERROR', 'Dati non validi', 400, details)
}
