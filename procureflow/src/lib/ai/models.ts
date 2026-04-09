export const MODELS = {
  SONNET: 'claude-sonnet-4-6',
  OPUS: 'claude-opus-4-6',
  HAIKU: 'claude-haiku-4-5',
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS]

type TaskType = 'classification' | 'extraction' | 'chat' | 'reasoning' | 'simple'

const TASK_MODEL_MAP: Record<TaskType, ModelId> = {
  classification: MODELS.SONNET,
  extraction: MODELS.SONNET,
  chat: MODELS.SONNET,
  reasoning: MODELS.OPUS,
  simple: MODELS.HAIKU,
}

export function getModelForTask(task: TaskType): ModelId {
  return TASK_MODEL_MAP[task]
}
