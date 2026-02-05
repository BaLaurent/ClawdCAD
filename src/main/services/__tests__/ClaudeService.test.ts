/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../CheckpointService', () => ({
  checkpointService: {
    createCheckpoint: vi.fn().mockReturnValue({ id: 'cp_test', timestamp: Date.now(), description: 'test', files: [], finalized: false }),
    snapshotFile: vi.fn(),
    finalizeCheckpoint: vi.fn(),
    listCheckpoints: vi.fn().mockReturnValue([]),
    undoCheckpoint: vi.fn().mockReturnValue({ restoredFiles: [] }),
  },
}))

vi.mock('../FileService', () => ({
  fileService: {
    readFile: vi.fn().mockResolvedValue({ content: '' }),
    saveFile: vi.fn().mockResolvedValue({ success: true }),
    listDirectory: vi.fn().mockResolvedValue({ files: [] }),
    validatePath: vi.fn().mockReturnValue(true),
  },
}))

vi.mock('../OpenScadRunner', () => ({
  openScadRunner: {
    compile: vi.fn().mockResolvedValue({ success: true, stlBuffer: null, offData: null, stderr: '', duration: 100 }),
  },
}))

vi.mock('../PreferencesService', () => ({
  preferencesService: {
    get: vi.fn().mockReturnValue({ maxIterations: 5, maxTokens: 4096 }),
  },
}))

import { claudeService } from '../ClaudeService'

// --- Helpers ---

/** Create an async iterable from an array of values */
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < items.length) return { value: items[i++], done: false }
          return { value: undefined as any, done: true }
        },
      }
    },
  }
}

/** Build a minimal mock Agent SDK */
function makeMockSdk(queryReturn?: AsyncIterable<any>) {
  return {
    query: vi.fn().mockReturnValue(queryReturn ?? asyncIter([{ type: 'result' }])),
    createSdkMcpServer: vi.fn().mockReturnValue({ name: 'ClawdCAD-tools' }),
    tool: vi.fn((_name: string, _desc: string, _schema: any, handler: any) => ({
      name: _name,
      handler,
    })),
  }
}

describe('ClaudeService', () => {
  let mockSdk: ReturnType<typeof makeMockSdk>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSdk = makeMockSdk()
    claudeService._injectSdkForTesting(mockSdk as any)
    // Clear any registered tools from previous tests
    for (const name of claudeService.getRegisteredTools()) {
      claudeService.unregisterTool(name)
    }
  })

  describe('isConfigured', () => {
    it('should return true when Agent SDK query yields a result', async () => {
      mockSdk.query.mockReturnValue(asyncIter([{ type: 'result' }]))
      const result = await claudeService.isConfigured()
      expect(result).toBe(true)
    })

    it('should return true when query yields a system init message', async () => {
      mockSdk.query.mockReturnValue(asyncIter([{ type: 'system', subtype: 'init' }]))
      const result = await claudeService.isConfigured()
      expect(result).toBe(true)
    })

    it('should return false when Agent SDK throws', async () => {
      claudeService._injectSdkForTesting(null as any)
      // Re-inject a sdk whose query() throws
      const brokenSdk = {
        query: vi.fn(() => { throw new Error('SDK not available') }),
        createSdkMcpServer: vi.fn(),
        tool: vi.fn(),
      }
      claudeService._injectSdkForTesting(brokenSdk as any)
      const result = await claudeService.isConfigured()
      expect(result).toBe(false)
    })
  })

  describe('sendMessage', () => {
    it('should call onToken for text_delta stream events', async () => {
      mockSdk.query.mockReturnValue(asyncIter([
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          },
        },
      ]))

      const onToken = vi.fn()
      const onEnd = vi.fn()
      const onError = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'user', content: 'Hi' }],
        undefined,
        undefined,
        { onToken, onEnd, onError }
      )

      expect(onToken).toHaveBeenCalledWith('Hello')
      expect(onEnd).toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    })

    it('should call onError when no user message provided', async () => {
      const onToken = vi.fn()
      const onEnd = vi.fn()
      const onError = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'assistant', content: 'I am assistant' }],
        undefined,
        undefined,
        { onToken, onEnd, onError }
      )

      expect(onError).toHaveBeenCalledWith('No user message provided.')
      expect(onEnd).not.toHaveBeenCalled()
    })

    it('should call onError when query throws', async () => {
      mockSdk.query.mockImplementation(() => { throw new Error('connection failed') })

      const onToken = vi.fn()
      const onEnd = vi.fn()
      const onError = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'user', content: 'Hi' }],
        undefined,
        undefined,
        { onToken, onEnd, onError }
      )

      expect(onError).toHaveBeenCalledWith('connection failed')
      expect(onEnd).not.toHaveBeenCalled()
    })

    it('should notify onToolCallStart for tool_use blocks', async () => {
      mockSdk.query.mockReturnValue(asyncIter([
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: { type: 'tool_use', id: 'tool_1', name: 'compile_openscad' },
          },
        },
      ]))

      const onToolCallStart = vi.fn()
      const onEnd = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'user', content: 'compile this' }],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd, onError: vi.fn(), onToolCallStart }
      )

      expect(onToolCallStart).toHaveBeenCalledWith(expect.objectContaining({
        type: 'tool_use',
        id: 'tool_1',
        name: 'compile_openscad',
      }))
    })
  })

  describe('tool registration', () => {
    it('should register and list tools', () => {
      const mockTool = { name: 'test_tool', handler: vi.fn() } as any
      claudeService.registerTool(mockTool)
      expect(claudeService.getRegisteredTools()).toContain('test_tool')
    })

    it('should unregister tools', () => {
      const mockTool = { name: 'test_tool', handler: vi.fn() } as any
      claudeService.registerTool(mockTool)
      expect(claudeService.unregisterTool('test_tool')).toBe(true)
      expect(claudeService.getRegisteredTools()).not.toContain('test_tool')
    })

    it('should return false when unregistering non-existent tool', () => {
      expect(claudeService.unregisterTool('nonexistent')).toBe(false)
    })

    it('should pass MCP servers to query when tools are registered', async () => {
      const mockTool = { name: 'my_tool', handler: vi.fn() } as any
      claudeService.registerTool(mockTool)
      mockSdk.query.mockReturnValue(asyncIter([]))

      await claudeService.sendMessage(
        [{ role: 'user', content: 'use tool' }],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
      )

      expect(mockSdk.createSdkMcpServer).toHaveBeenCalled()
      const queryCall = mockSdk.query.mock.calls[0][0]
      expect(queryCall.options.mcpServers).toBeDefined()
      expect(queryCall.options.mcpServers['ClawdCAD-tools']).toBeDefined()
    })

    it('should not pass MCP servers when no tools registered', async () => {
      mockSdk.query.mockReturnValue(asyncIter([]))

      await claudeService.sendMessage(
        [{ role: 'user', content: 'hello' }],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
      )

      expect(mockSdk.createSdkMcpServer).not.toHaveBeenCalled()
      const queryCall = mockSdk.query.mock.calls[0][0]
      expect(queryCall.options.mcpServers).toBeUndefined()
    })
  })

  describe('assistant message tool_use path', () => {
    it('should call onToolCallStart for tool_use blocks inside assistant messages', async () => {
      mockSdk.query.mockReturnValue(asyncIter([
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'x', name: 'read_file', input: { path: '/tmp' } },
            ],
          },
        },
      ]))

      const onToolCallStart = vi.fn()
      const onEnd = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'user', content: 'read a file' }],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd, onError: vi.fn(), onToolCallStart }
      )

      expect(onToolCallStart).toHaveBeenCalledWith(expect.objectContaining({
        type: 'tool_use',
        id: 'x',
        name: 'read_file',
      }))
      expect(onEnd).toHaveBeenCalled()
    })
  })

  describe('tool_result and tool_output callbacks', () => {
    it('should call onToolCallResult for tool_result messages', async () => {
      mockSdk.query.mockReturnValue(asyncIter([
        { type: 'tool_result', tool_use_id: 'x', content: 'ok', is_error: false },
      ]))

      const onToolCallResult = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'user', content: 'run tool' }],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd: vi.fn(), onError: vi.fn(), onToolCallResult }
      )

      expect(onToolCallResult).toHaveBeenCalledWith({
        type: 'tool_result',
        tool_use_id: 'x',
        content: 'ok',
        is_error: false,
      })
    })

    it('should call onToolCallResult for tool_output messages with error', async () => {
      mockSdk.query.mockReturnValue(asyncIter([
        { type: 'tool_output', id: 'y', output: 'fail', error: true },
      ]))

      const onToolCallResult = vi.fn()

      await claudeService.sendMessage(
        [{ role: 'user', content: 'run tool' }],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd: vi.fn(), onError: vi.fn(), onToolCallResult }
      )

      expect(onToolCallResult).toHaveBeenCalledWith({
        type: 'tool_result',
        tool_use_id: 'y',
        content: 'fail',
        is_error: true,
      })
    })
  })

  describe('systemPrompt and projectDir forwarding', () => {
    it('should forward custom systemPrompt and projectDir to query options', async () => {
      mockSdk.query.mockReturnValue(asyncIter([]))

      await claudeService.sendMessage(
        [{ role: 'user', content: 'hello' }],
        'Custom prompt',
        '/my/project',
        { onToken: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
      )

      const queryCall = mockSdk.query.mock.calls[0][0]
      expect(queryCall.options.systemPrompt).toBe('Custom prompt')
      expect(queryCall.options.cwd).toBe('/my/project')
    })
  })

  describe('conversation history prompt building', () => {
    it('should build Previous conversation prefix from multi-message array', async () => {
      mockSdk.query.mockReturnValue(asyncIter([]))

      await claudeService.sendMessage(
        [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'second' },
        ],
        undefined,
        undefined,
        { onToken: vi.fn(), onEnd: vi.fn(), onError: vi.fn() }
      )

      const queryCall = mockSdk.query.mock.calls[0][0]
      expect(queryCall.prompt).toContain('Previous conversation:')
      expect(queryCall.prompt).toContain('User: first')
      expect(queryCall.prompt).toContain('Assistant: reply')
      expect(queryCall.prompt).toMatch(/User: second$/)
    })
  })

  describe('isConfigured edge cases', () => {
    it('should return false when result has is_error true', async () => {
      mockSdk.query.mockReturnValue(asyncIter([{ type: 'result', is_error: true }]))
      const result = await claudeService.isConfigured()
      expect(result).toBe(false)
    })
  })
})
