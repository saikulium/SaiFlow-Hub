import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'

// ---------------------------------------------------------------------------
// Shared Claude client — singleton with retry and logging
// ---------------------------------------------------------------------------

let client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

interface CallClaudeOptions {
  readonly system: string
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant'
    readonly content: string
  }>
  readonly maxTokens: number
  readonly tools?: ReadonlyArray<Anthropic.Tool>
  readonly model?: string
}

const DEFAULT_MODEL = MODELS.SONNET
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function callClaude(
  options: CallClaudeOptions,
): Promise<Anthropic.Message> {
  const anthropic = getClaudeClient()
  const model = options.model ?? DEFAULT_MODEL

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const start = Date.now()
      const response = await anthropic.messages.create({
        model,
        system: options.system,
        messages: options.messages as Anthropic.MessageParam[],
        max_tokens: options.maxTokens,
        ...(options.tools ? { tools: options.tools as Anthropic.Tool[] } : {}),
      })

      console.log(
        `[claude-client] model=${model} tokens_in=${response.usage.input_tokens}` +
          ` tokens_out=${response.usage.output_tokens} latency_ms=${Date.now() - start}`,
      )

      return response
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(
          `[claude-client] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`,
          error,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Extract JSON from an AI response that may contain markdown fences or extra text.
 */
export function extractJsonFromAiResponse(raw: string): string {
  // Strip markdown code fences if present (```json ... ```)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1]!.trim()
  // Try to find a JSON array
  const arrayMatch = raw.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]!
  // Try to find a JSON object
  const braceMatch = raw.match(/\{[\s\S]*\}/)
  if (braceMatch) return braceMatch[0]!
  return raw.trim()
}
