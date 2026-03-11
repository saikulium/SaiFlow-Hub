export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const

export const ALLOWED_EXTENSIONS_LABEL = 'PDF, DOCX, XLSX, PNG, JPG'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function validateAttachment(file: {
  type: string
  size: number
  name: string
}): { valid: true } | { valid: false; error: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `Tipo file non supportato: ${file.type}. Formati accettati: ${ALLOWED_EXTENSIONS_LABEL}`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File troppo grande (${sizeMB} MB). Dimensione massima: 10 MB`,
    }
  }

  return { valid: true }
}
