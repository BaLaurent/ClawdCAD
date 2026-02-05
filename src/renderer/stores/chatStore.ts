import { create } from 'zustand'
import { ChatMessage, ToolCallBlock, ToolResultBlock, Checkpoint, ImageAttachment } from '../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  error: string | null
  activeToolCalls: ToolCallBlock[]
  completedToolResults: ToolResultBlock[]
  checkpoints: Checkpoint[]
  pendingImages: ImageAttachment[]

  addUserMessage: (content: string, images?: ImageAttachment[]) => void
  addSystemMessage: (content: string) => void
  startStreaming: () => void
  appendToken: (token: string) => void
  finishStreaming: () => void
  setError: (error: string) => void
  clearError: () => void
  clearConversation: () => void
  addToolCall: (toolCall: ToolCallBlock) => void
  addToolResult: (result: ToolResultBlock) => void
  setToolCallImage: (imageData: string) => void
  addPendingImage: (image: ImageAttachment) => void
  removePendingImage: (id: string) => void
  clearPendingImages: () => void
  addCheckpoint: (checkpoint: Checkpoint) => void
  removeCheckpoint: (id: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  error: null,
  activeToolCalls: [],
  completedToolResults: [],
  checkpoints: [],
  pendingImages: [],

  addUserMessage: (content: string, images?: ImageAttachment[]) => {
    const message: ChatMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
      ...(images && images.length > 0 && { images }),
    }
    set((state) => ({ messages: [...state.messages, message], error: null }))
  },

  addSystemMessage: (content: string) => {
    const message: ChatMessage = {
      role: 'assistant',
      content,
      timestamp: Date.now(),
    }
    set((state) => ({ messages: [...state.messages, message] }))
  },

  startStreaming: () => {
    set({ isStreaming: true, streamingContent: '', error: null })
  },

  appendToken: (token: string) => {
    set((state) => ({ streamingContent: state.streamingContent + token }))
  },

  finishStreaming: () => {
    const { streamingContent, messages, activeToolCalls, completedToolResults } = get()
    if (streamingContent) {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: streamingContent,
        timestamp: Date.now(),
        toolCalls: activeToolCalls.length > 0 ? [...activeToolCalls] : undefined,
        toolResults: completedToolResults.length > 0 ? [...completedToolResults] : undefined,
      }
      set({
        messages: [...messages, assistantMessage],
        isStreaming: false,
        streamingContent: '',
        activeToolCalls: [],
        completedToolResults: [],
      })
    } else {
      set({ isStreaming: false, streamingContent: '', activeToolCalls: [], completedToolResults: [] })
    }
  },

  setError: (error: string) => {
    set({ error, isStreaming: false, streamingContent: '' })
  },

  clearError: () => {
    set({ error: null })
  },

  clearConversation: () => {
    set({ messages: [], streamingContent: '', isStreaming: false, error: null, activeToolCalls: [], completedToolResults: [], checkpoints: [], pendingImages: [] })
  },

  addToolCall: (toolCall: ToolCallBlock) => {
    console.log('[chatStore] addToolCall received:', toolCall.name, toolCall.id, 'streamingContent length:', get().streamingContent.length)
    const { streamingContent, messages } = get()
    // Flush any pending streamed text as its own message before showing the tool call
    let updatedMessages = streamingContent
      ? [...messages, { role: 'assistant' as const, content: streamingContent, timestamp: Date.now() }]
      : [...messages]
    // Insert a pending tool execution message inline (preserves chronological order)
    const toolMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      toolExecution: { call: toolCall },
      timestamp: Date.now(),
    }
    updatedMessages.push(toolMessage)
    set({
      messages: updatedMessages,
      streamingContent: '',
      activeToolCalls: [...get().activeToolCalls, toolCall],
    })
  },

  addToolResult: (result: ToolResultBlock) => {
    console.log('[chatStore] addToolResult received:', result.tool_use_id, result.is_error ? 'ERROR' : 'OK', 'content length:', result.content.length)
    const { activeToolCalls, messages } = get()
    // Update the existing tool execution message in-place (preserves order)
    const updatedMessages = messages.map(msg => {
      if (msg.toolExecution && msg.toolExecution.call.id === result.tool_use_id) {
        return { ...msg, toolExecution: { call: msg.toolExecution.call, result } }
      }
      return msg
    })
    set({
      messages: updatedMessages,
      activeToolCalls: activeToolCalls.filter(tc => tc.id !== result.tool_use_id),
      completedToolResults: [...get().completedToolResults, result],
    })
  },

  setToolCallImage: (imageData: string) => {
    const { messages } = get()
    // Find the last capture_viewport tool call (MCP-prefixed name) and attach image
    const updatedMessages = [...messages]
    for (let i = updatedMessages.length - 1; i >= 0; i--) {
      const msg = updatedMessages[i]
      if (msg.toolExecution && msg.toolExecution.call.name.endsWith('capture_viewport')) {
        const result: ToolResultBlock = {
          type: 'tool_result',
          tool_use_id: msg.toolExecution.call.id,
          content: 'Viewport captured',
          imageData,
        }
        updatedMessages[i] = { ...msg, toolExecution: { call: msg.toolExecution.call, result } }
        break
      }
    }
    set({ messages: updatedMessages })
  },

  addPendingImage: (image: ImageAttachment) => {
    set((state) => ({ pendingImages: [...state.pendingImages, image] }))
  },

  removePendingImage: (id: string) => {
    set((state) => ({ pendingImages: state.pendingImages.filter(img => img.id !== id) }))
  },

  clearPendingImages: () => {
    set({ pendingImages: [] })
  },

  addCheckpoint: (checkpoint: Checkpoint) => {
    set((state) => ({
      checkpoints: [...state.checkpoints, checkpoint],
    }))
  },

  removeCheckpoint: (id: string) => {
    set((state) => ({
      checkpoints: state.checkpoints.filter(cp => cp.id !== id),
    }))
  },
}))
