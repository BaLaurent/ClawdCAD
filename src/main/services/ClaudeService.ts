import os from 'os'
import { preferencesService } from './PreferencesService'
import type { ImageAttachment } from '../../shared/types'

// Dynamic import for ESM-only Agent SDK (CommonJS tsconfig compiles
// static imports into require(), which fails for .mjs modules)
type AgentSDK = typeof import('@anthropic-ai/claude-agent-sdk')
let _sdkCache: AgentSDK | null = null

async function loadAgentSDK(): Promise<AgentSDK> {
  if (!_sdkCache) {
    _sdkCache = await (Function('return import("@anthropic-ai/claude-agent-sdk")')() as Promise<AgentSDK>)
  }
  return _sdkCache
}

const OPENSCAD_SYSTEM_PROMPT = `You are an expert OpenSCAD developer and 3D modeling assistant integrated into ClawdCAD, a desktop parametric CAD application.

Your capabilities:
- Generate complete, valid OpenSCAD code from natural language descriptions
- Explain OpenSCAD code and concepts clearly
- Debug and fix OpenSCAD compilation errors
- Suggest improvements to existing models
- Help with parametric design patterns

Guidelines:
- Always produce valid OpenSCAD syntax
- Use modules and functions for reusable components
- Include comments explaining the design intent
- Use $fn for controlling resolution (suggest appropriate values)
- Prefer parametric designs with variables at the top
- When generating code, wrap it in \`\`\`openscad code blocks

You help users go from idea to 3D-printable model efficiently.`

const DEFAULT_MAX_TURNS = 10

interface ToolCallInfo {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface ToolResultInfo {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
  imageData?: string
}

interface SendCallbacks {
  onToken: (token: string) => void
  onEnd: () => void
  onError: (error: string) => void
  onToolCallStart?: (toolCall: ToolCallInfo) => void
  onToolCallResult?: (result: ToolResultInfo) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RegisteredTool = import('@anthropic-ai/claude-agent-sdk').SdkMcpToolDefinition<any>

class ClaudeService {
  private tools: Map<string, RegisteredTool> = new Map()
  /** Images attached by the user for the current message, consumed by view_user_attachments MCP tool */
  pendingUserImages: ImageAttachment[] = []

  // Structural input type avoids contravariance mismatch between sdk.tool() output and SdkMcpToolDefinition<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTool(toolDef: { name: string; [k: string]: any }): void {
    this.tools.set(toolDef.name, toolDef as RegisteredTool)
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name)
  }

  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys())
  }

  private async buildMcpServers(): Promise<Record<string, import('@anthropic-ai/claude-agent-sdk').McpSdkServerConfigWithInstance> | undefined> {
    if (this.tools.size === 0) return undefined
    const sdk = await loadAgentSDK()
    const server = sdk.createSdkMcpServer({
      name: 'ClawdCAD-tools',
      version: '1.0.0',
      tools: Array.from(this.tools.values()),
    })
    return { 'ClawdCAD-tools': server }
  }

  async sendMessage(
    messages: Array<{ role: string; content: string; images?: ImageAttachment[] }>,
    systemPrompt: string | undefined,
    projectDir: string | undefined,
    callbacks: SendCallbacks
  ): Promise<void> {
    const effectiveDir = projectDir || os.homedir()

    try {
      const sdk = await loadAgentSDK()
      const query = sdk.query

      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMessage) {
        callbacks.onError('No user message provided.')
        return
      }

      const contextParts: string[] = []
      for (const msg of messages.slice(0, -1)) {
        const label = msg.role === 'user' ? 'User' : 'Assistant'
        contextParts.push(`${label}: ${msg.content}`)
      }

      let prompt = lastUserMessage.content
      if (contextParts.length > 0) {
        prompt = `Previous conversation:\n${contextParts.join('\n\n')}\n\nUser: ${lastUserMessage.content}`
      }

      // Store images for the view_user_attachments MCP tool to serve
      const lastImages = lastUserMessage.images
      if (lastImages && lastImages.length > 0) {
        this.pendingUserImages = lastImages
        const count = lastImages.length
        prompt += `\n\n[The user attached ${count} image${count > 1 ? 's' : ''}. Call the view_user_attachments tool to see ${count > 1 ? 'them' : 'it'}.]`
      } else {
        this.pendingUserImages = []
      }

      const maxTurns = preferencesService.get('agent')?.maxIterations ?? DEFAULT_MAX_TURNS
      const mcpServers = await this.buildMcpServers()

      const agentQuery = query({
        prompt,
        options: {
          systemPrompt: systemPrompt || OPENSCAD_SYSTEM_PROMPT,
          maxTurns,
          cwd: effectiveDir,
          includePartialMessages: true,
          permissionMode: 'bypassPermissions' as const,
          allowDangerouslySkipPermissions: true,
          ...(mcpServers && { mcpServers }),
        },
      })

      const seenToolIds = new Set<string>()

      for await (const message of agentQuery) {
        const msg = message as Record<string, unknown>
        console.log('[AgentSDK] message type:', msg.type, 'keys:', Object.keys(msg).join(','))

        if (msg.type === 'stream_event') {
          const event = msg.event as { type?: string; delta?: { type: string; text: string }; content_block?: { type: string; id?: string; name?: string } } | undefined
          if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            callbacks.onToken(event.delta.text)
          }
          // Detect tool_use content block start
          if (event?.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            const block = event.content_block as { id?: string; name?: string; input?: Record<string, unknown> }
            if (block.id && block.name && !seenToolIds.has(block.id)) {
              seenToolIds.add(block.id)
              console.log('[AgentSDK] tool_use block start:', block.name, block.id)
              callbacks.onToolCallStart?.({
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: block.input || {},
              })
            }
          }
        }

        // Handle assistant messages with tool_use content blocks
        if (msg.type === 'assistant') {
          const assistantMsg = msg.message as { content?: Array<{ type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string }> } | undefined
          if (assistantMsg?.content) {
            for (const block of assistantMsg.content) {
              if (block.type === 'tool_use' && block.id && block.name && !seenToolIds.has(block.id)) {
                seenToolIds.add(block.id)
                console.log('[AgentSDK] assistant tool_use:', block.name, block.id)
                callbacks.onToolCallStart?.({
                  type: 'tool_use',
                  id: block.id,
                  name: block.name,
                  input: block.input || {},
                })
              }
            }
          }
        }

        // Handle tool results
        if (msg.type === 'tool_result' || msg.type === 'tool_output') {
          const toolId = (msg.tool_use_id || msg.id || '') as string
          const rawContent = msg.content || msg.output || ''
          const isError = !!(msg.is_error || msg.error)
          console.log('[AgentSDK] tool result for:', toolId, isError ? 'ERROR' : 'OK')
          if (toolId) {
            // Extract image data from structured content arrays
            let textContent = ''
            let imageData: string | undefined
            if (typeof rawContent === 'string') {
              textContent = rawContent
            } else if (Array.isArray(rawContent)) {
              const parts: string[] = []
              for (const block of rawContent) {
                if (block && typeof block === 'object' && 'type' in block) {
                  if (block.type === 'image' && typeof block.data === 'string') {
                    imageData = block.data
                  } else if (block.type === 'text' && typeof block.text === 'string') {
                    parts.push(block.text)
                  }
                }
              }
              textContent = parts.join('\n') || (imageData ? 'Image captured' : JSON.stringify(rawContent))
            } else {
              textContent = JSON.stringify(rawContent)
            }
            callbacks.onToolCallResult?.({
              type: 'tool_result',
              tool_use_id: toolId,
              content: textContent,
              is_error: isError,
              imageData,
            })
          }
        }
      }

      this.pendingUserImages = []
      callbacks.onEnd()
    } catch (err) {
      const errObj = err as { message?: string }
      const message = errObj?.message || 'Agent SDK error. Is Claude Code installed?'
      this.pendingUserImages = []
      console.error('ClaudeService error:', message)
      callbacks.onError(message)
    }
  }

  /** @internal Test seam: inject a mock SDK to bypass dynamic import */
  _injectSdkForTesting(sdk: AgentSDK | null): void {
    _sdkCache = sdk
  }

  async isConfigured(): Promise<boolean> {
    return this.isAgentSDKAvailable()
  }

  async isAgentSDKAvailable(): Promise<boolean> {
    try {
      const { query } = await loadAgentSDK()

      const testQuery = query({
        prompt: 'Reply with OK',
        options: {
          maxTurns: 1,
          allowedTools: [],
          permissionMode: 'bypassPermissions' as const,
          allowDangerouslySkipPermissions: true,
        },
      })

      for await (const message of testQuery) {
        if (message.type === 'system' && (message as { subtype?: string }).subtype === 'init') {
          return true
        }
        if (message.type === 'result') {
          return !(message as { is_error?: boolean }).is_error
        }
      }
      return true
    } catch {
      return false
    }
  }
}

export const claudeService = new ClaudeService()
