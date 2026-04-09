import type Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { MODELS } from '@/lib/ai/models'
import { storePendingAction } from '@/lib/ai/pending-actions'
import {
  getToolsForRole,
  isWriteTool,
  generateActionPreview,
  executeWriteTool,
} from '@/server/agents/tools/procurement.tools'
import type { UserRole, ZodTool } from '@/server/agents/tools/procurement.tools'
import type { AgentStreamEvent } from '@/types/ai'

// ---------------------------------------------------------------------------
// Re-export executeWriteTool for the confirm endpoint
// ---------------------------------------------------------------------------

export { executeWriteTool } from '@/server/agents/tools/procurement.tools'
export type { UserRole } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const MAX_TOOL_ROUNDS = 10
const MAX_TOKENS = 4096

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/**
 * Convert ZodTool[] to the Anthropic beta tool format for the API.
 * We extract the JSON schema from each tool's definition for the API call,
 * while keeping the Zod-validated `run` and `parse` available locally.
 */
function toBetaTools(tools: readonly ZodTool[]): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => ({
    type: 'custom' as const,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
}

/**
 * Find a runnable tool by name and execute it with Zod-validated input.
 */
async function executeReadTool(
  tools: readonly ZodTool[],
  toolName: string,
  rawInput: unknown,
): Promise<string> {
  const tool = tools.find((t) => t.name === toolName)
  if (!tool) {
    return JSON.stringify({ error: `Tool sconosciuto: ${toolName}` })
  }
  try {
    // Zod-parse the input, then run
    const parsed = tool.parse(rawInput)
    const result = await tool.run(parsed)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({
      error: `Errore nell'esecuzione del tool: ${String(err)}`,
    })
  }
}

// ---------------------------------------------------------------------------
// Stream Agent Response (async generator) — betaZodTool version
// ---------------------------------------------------------------------------

/**
 * Streams agent responses as AgentStreamEvent items.
 *
 * This is a drop-in replacement for the original `streamAgentResponse` from
 * `agent.service.ts` but uses:
 * - betaZodTool definitions with Zod input validation
 * - MODELS.SONNET instead of Haiku
 * - Up to MAX_TOOL_ROUNDS=10 iterations (vs. the old 3)
 * - The Beta Messages API
 *
 * For WRITE tools, the loop intercepts the call, stores a pending action,
 * yields an `action_request` event, and terminates. The user must confirm
 * the action through the `/api/chat/confirm` endpoint.
 */
export async function* streamAssistantResponse(
  userId: string,
  role: UserRole,
  messages: readonly ChatMessage[],
): AsyncGenerator<AgentStreamEvent> {
  const tools = getToolsForRole(role)
  const betaTools = toBetaTools(tools)

  const client = getClaudeClient()

  // Build mutable conversation for the agentic loop
  let conversationMessages: Anthropic.Beta.BetaMessageParam[] = messages.map(
    (m) => ({
      role: m.role,
      content: m.content,
    }),
  )

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Beta.BetaMessage

    try {
      response = await client.beta.messages.create({
        model: AGENT_MODEL,
        system: AGENT_SYSTEM_PROMPT,
        messages: conversationMessages,
        max_tokens: MAX_TOKENS,
        tools: betaTools,
      })
    } catch (err) {
      yield { type: 'error', message: `Errore AI: ${String(err)}` }
      return
    }

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
    let hasToolUse = false

    for (const block of response.content) {
      if (block.type === 'text') {
        yield { type: 'text', content: block.text }
      } else if (block.type === 'tool_use') {
        hasToolUse = true
        const toolName = block.name
        const toolParams = block.input as Record<string, unknown>

        yield { type: 'tool_start', name: toolName }

        // WRITE tool: intercept, store pending action, yield and stop
        if (isWriteTool(toolName)) {
          const preview = generateActionPreview(toolName, toolParams)
          const actionId = storePendingAction({
            tool: toolName,
            params: toolParams,
            userId,
            preview,
          })
          yield {
            type: 'action_request',
            actionId,
            tool: toolName,
            params: toolParams,
            preview,
          }
          return
        }

        // READ tool: execute with Zod validation, feed result back
        const toolResult = await executeReadTool(tools, toolName, toolParams)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult,
        })

        yield { type: 'tool_end', name: toolName }
      }
    }

    // No tool calls means the model finished its response
    if (!hasToolUse) {
      yield { type: 'done' }
      return
    }

    // Feed tool results back for the next round
    conversationMessages = [
      ...conversationMessages,
      { role: 'assistant' as const, content: response.content },
      { role: 'user' as const, content: toolResults },
    ]
  }

  // Max rounds reached
  yield {
    type: 'text',
    content:
      '\n\n_Ho raggiunto il limite di iterazioni. Prova a riformulare la domanda in modo piu specifico._',
  }
  yield { type: 'done' }
}
