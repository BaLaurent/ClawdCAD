import { useState, useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useEditorStore } from '../stores/editorStore'
import { useCompilerStore } from '../stores/compilerStore'
import { useViewerStore } from '../stores/viewerStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useProjectStore } from '../stores/projectStore'
import { ChatMessage, ToolCallBlock, ToolResultBlock, Checkpoint, ImageAttachment } from '../../shared/types'

interface CodeBlockActions {
  onApply: (code: string) => void
  onInsert: (code: string) => void
  onCopy: (code: string) => void
}

function CodeBlock({ lang, code, actions }: { lang: string; code: string; actions?: CodeBlockActions }) {
  const [copied, setCopied] = useState(false)
  const isScad = !lang || lang === 'openscad' || lang === 'scad'

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    actions?.onCopy(code)
  }

  return (
    <div className="my-2 relative group" data-testid="code-block">
      <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 overflow-x-auto text-xs">
        {lang && <div className="text-gray-400 dark:text-gray-500 text-xs mb-1">{lang}</div>}
        <code className="text-green-700 dark:text-green-300">{code}</code>
      </pre>
      <div className="flex gap-1 mt-1">
        {isScad && actions && (
          <>
            <button
              className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
              onClick={() => actions.onApply(code)}
              data-testid="apply-code-btn"
              title="Replace editor content with this code"
            >
              ✓ Apply Code
            </button>
            <button
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
              onClick={() => actions.onInsert(code)}
              data-testid="insert-at-cursor-btn"
              title="Insert at cursor position"
            >
              ⤓ Insert at Cursor
            </button>
          </>
        )}
        <button
          className={`text-xs px-2 py-1 rounded ${copied ? 'bg-gray-300 dark:bg-gray-600 text-green-700 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
          onClick={handleCopy}
          data-testid="copy-code-btn"
          title="Copy to clipboard"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
    </div>
  )
}

function formatCode(text: string, actions?: CodeBlockActions): JSX.Element[] {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3)
      const firstNewline = lines.indexOf('\n')
      const lang = firstNewline > 0 ? lines.slice(0, firstNewline).trim() : ''
      const code = firstNewline > 0 ? lines.slice(firstNewline + 1) : lines
      return <CodeBlock key={i} lang={lang} code={code} actions={actions} />
    }
    // Render inline code
    const inlineParts = part.split(/(`[^`]+`)/g)
    return (
      <span key={i}>
        {inlineParts.map((ip, j) => {
          if (ip.startsWith('`') && ip.endsWith('`')) {
            return (
              <code key={j} className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded text-green-700 dark:text-green-300 text-xs">
                {ip.slice(1, -1)}
              </code>
            )
          }
          return <span key={j}>{ip}</span>
        })}
      </span>
    )
  })
}

/**
 * Confirmation dialog for applying code to the editor.
 * Shows a diff preview (old vs new) before replacing.
 */
function ApplyCodeDialog({
  oldCode,
  newCode,
  mode,
  onConfirm,
  onCancel,
}: {
  oldCode: string
  newCode: string
  mode: 'replace' | 'insert'
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" data-testid="apply-code-dialog">
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl w-[90%] max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {mode === 'replace' ? '⚠️ Replace Editor Content' : '⤓ Insert at Cursor'}
          </h3>
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-lg"
            onClick={onCancel}
            data-testid="dialog-cancel-x"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {mode === 'replace' && oldCode && (
            <div>
              <div className="text-xs text-red-400 font-semibold mb-1">Current (will be replaced):</div>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-2 text-xs text-red-600 dark:text-red-300 overflow-x-auto max-h-40 overflow-y-auto" data-testid="diff-old">
                {oldCode.slice(0, 2000)}{oldCode.length > 2000 ? '\n... [truncated]' : ''}
              </pre>
            </div>
          )}
          <div>
            <div className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">
              {mode === 'replace' ? 'New code:' : 'Code to insert:'}
            </div>
            <pre className="bg-gray-100 dark:bg-gray-900 rounded p-2 text-xs text-green-700 dark:text-green-300 overflow-x-auto max-h-40 overflow-y-auto" data-testid="diff-new">
              {newCode.slice(0, 2000)}{newCode.length > 2000 ? '\n... [truncated]' : ''}
            </pre>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200"
            onClick={onCancel}
            data-testid="dialog-cancel"
          >
            Cancel
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white font-medium"
            onClick={onConfirm}
            data-testid="dialog-confirm"
          >
            {mode === 'replace' ? 'Replace' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolCallDisplay({ toolCall, result }: { toolCall: ToolCallBlock; result?: ToolResultBlock }) {
  const [expanded, setExpanded] = useState(false)
  const isError = result?.is_error
  const isPending = !result

  const icon = isPending ? '\u23F3' : isError ? '\u274C' : '\u2713'
  const statusColor = isPending ? 'text-yellow-500 dark:text-yellow-400' : isError ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'

  return (
    <div className="my-1 border border-gray-300 dark:border-gray-600 rounded text-xs" data-testid="tool-call-display">
      <button
        className="w-full flex items-center gap-2 px-2 py-1 hover:bg-gray-300/30 dark:hover:bg-gray-600/30 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={statusColor}>{icon}</span>
        <span className="text-gray-700 dark:text-gray-300 font-mono">{toolCall.name.includes('__') ? toolCall.name.split('__').pop() : toolCall.name}</span>
        {toolCall.name === 'read_file' || toolCall.name === 'write_file' || toolCall.name === 'edit_file' ? (
          <span className="text-gray-400 dark:text-gray-500 truncate">{String(toolCall.input.path || '')}</span>
        ) : null}
        <span className="ml-auto text-gray-400 dark:text-gray-600">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && (
        <div className="px-2 py-1 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <div>
            <span className="text-gray-400 dark:text-gray-500">Input:</span>
            <pre className="text-gray-500 dark:text-gray-400 overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {result && (
            <div>
              <span className="text-gray-400 dark:text-gray-500">Result:</span>
              <pre className={`overflow-x-auto max-h-32 overflow-y-auto ${isError ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                {result.content.slice(0, 2000)}{result.content.length > 2000 ? '\n... [truncated]' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CheckpointBanner({ checkpoint, onUndo }: { checkpoint: Checkpoint; onUndo: (id: string) => void }) {
  const [undone, setUndone] = useState(false)
  const fileCount = checkpoint.files.length

  if (undone) {
    return (
      <div className="mx-3 mb-2 px-3 py-2 bg-green-100/30 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded text-xs text-green-700 dark:text-green-300" data-testid="checkpoint-undone">
        Changes reverted
      </div>
    )
  }

  return (
    <div className="mx-3 mb-2 px-3 py-2 bg-amber-100/20 dark:bg-amber-900/20 border border-amber-300/50 dark:border-amber-700/50 rounded text-xs flex items-center justify-between" data-testid="checkpoint-banner">
      <span className="text-amber-700 dark:text-amber-300">AI modified {fileCount} file{fileCount !== 1 ? 's' : ''}</span>
      <button
        className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-0.5 rounded"
        onClick={() => {
          onUndo(checkpoint.id)
          setUndone(true)
          setTimeout(() => {
            useChatStore.getState().removeCheckpoint(checkpoint.id)
          }, 3000)
        }}
        data-testid="undo-checkpoint"
      >
        Undo
      </button>
    </div>
  )
}

function ToolExecutionBubble({ call, result }: { call: ToolCallBlock; result?: ToolResultBlock }) {
  const hasImage = !!result?.imageData
  const [expanded, setExpanded] = useState(false)
  const isPending = !result
  const isError = result?.is_error
  const icon = isPending ? '\u23F3' : isError ? '\u274C' : hasImage ? '\uD83D\uDDBC' : '\u2713'
  const borderColor = isPending ? 'border-yellow-300/50 dark:border-yellow-700/50' : isError ? 'border-red-300/50 dark:border-red-700/50' : 'border-emerald-300/50 dark:border-emerald-700/50'
  const bgColor = isPending ? 'bg-yellow-50/30 dark:bg-yellow-950/30' : isError ? 'bg-red-50/40 dark:bg-red-950/40' : 'bg-emerald-50/40 dark:bg-emerald-950/40'
  const iconColor = isPending ? 'text-yellow-500 dark:text-yellow-400' : isError ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'

  // Summarize tool action — strip MCP server prefix (e.g. mcp__ClawdCAD-tools__capture_viewport → capture_viewport)
  const summary = (() => {
    const filePath = String(call.input.path || '')
    const toolName = call.name.includes('__') ? call.name.split('__').pop()! : call.name
    switch (toolName) {
      case 'read_file': return `Read ${filePath}`
      case 'write_file': return `Wrote ${filePath}`
      case 'edit_file': return `Edited ${filePath}`
      case 'compile': return call.input.source ? 'Compiled source' : 'Compiled project file'
      case 'compile_openscad': return 'Compiled OpenSCAD'
      case 'list_directory': return `Listed ${filePath || '.'}`
      case 'capture_viewport': return 'Captured 3D viewport'
      case 'view_user_attachments': return 'Viewing attached images'
      default: return toolName.replace(/_/g, ' ')
    }
  })()

  // Auto-expand when image result arrives
  const prevHasImage = useRef(false)
  useEffect(() => {
    if (hasImage && !prevHasImage.current) {
      setExpanded(true)
    }
    prevHasImage.current = hasImage
  }, [hasImage])

  return (
    <div className={`flex justify-start mb-2`} data-testid={isPending ? 'tool-pending' : 'tool-execution-message'}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs border ${borderColor} ${bgColor}`}>
        <button
          className="w-full flex items-center gap-2 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <span className={`font-mono ${iconColor} ${isPending ? 'animate-pulse' : ''}`}>{icon}</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">{summary}</span>
          <span className="ml-auto text-gray-400 dark:text-gray-600 text-[10px]">{expanded ? '\u25B2' : '\u25BC'}</span>
        </button>
        {expanded && (
          <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2">
            {call.input && Object.keys(call.input).length > 0 && (
              <div>
                <span className="text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wide">Input</span>
                <pre className="text-gray-500 dark:text-gray-400 overflow-x-auto max-h-32 overflow-y-auto mt-0.5">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </div>
            )}
            {hasImage && (
              <div>
                <span className="text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wide">Viewport capture</span>
                <img
                  src={`data:image/png;base64,${result.imageData}`}
                  alt="3D viewport capture"
                  className="mt-1 rounded border border-gray-200/50 dark:border-gray-700/50 max-w-full max-h-64 object-contain"
                />
              </div>
            )}
            {result && !hasImage && (
              <div>
                <span className="text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wide">Result</span>
                <pre className={`overflow-x-auto max-h-40 overflow-y-auto mt-0.5 ${isError ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {result.content.slice(0, 3000)}{result.content.length > 3000 ? '\n... [truncated]' : ''}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message, codeActions }: { message: ChatMessage; codeActions?: CodeBlockActions }) {
  const isUser = message.role === 'user'

  // Tool execution messages get their own distinct bubble
  if (message.toolExecution) {
    return <ToolExecutionBubble call={message.toolExecution.call} result={message.toolExecution.result} />
  }

  // Skip empty assistant messages (can happen after flushing before tool calls)
  if (!isUser && !message.content) return null

  // Find matching results for tool calls
  const getResultForToolCall = (tc: ToolCallBlock): ToolResultBlock | undefined => {
    return message.toolResults?.find(tr => tr.tool_use_id === tc.id)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`} data-testid="chat-message">
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
        }`}
        data-testid={isUser ? 'user-message' : 'assistant-message'}
      >
        {isUser ? message.content : formatCode(message.content, codeActions)}
        {isUser && message.images && message.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.images.map((img) => (
              <img
                key={img.id}
                src={`data:${img.mediaType};base64,${img.data}`}
                alt="Attached image"
                className="rounded border border-blue-400/30 max-w-[200px] max-h-[200px] object-contain"
              />
            ))}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallDisplay key={tc.id} toolCall={tc} result={getResultForToolCall(tc)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="flex justify-start mb-3">
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg rounded-bl-sm px-3 py-2 text-sm">
          <span className="animate-pulse">Thinking...</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start mb-3" data-testid="streaming-message">
      <div className="max-w-[85%] bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap">
        {formatCode(content)}
        <span className="animate-pulse">|</span>
      </div>
    </div>
  )
}

/**
 * Build AI context from current editor, compiler, and viewer state.
 * Returns an XML-tagged system prompt section for Claude.
 */
function buildContext(
  editorContent: string,
  activeFileName: string | null,
  compilerErrors: Array<{ line: number; column: number; message: string; severity: string }>,
  modelBounds: { min: [number, number, number]; max: [number, number, number] } | null,
  maxTokens: number,
): string {
  const sections: string[] = []

  // Current editor source
  if (editorContent) {
    // Rough token estimate: ~4 chars per token
    const tokenBudget = Math.floor(maxTokens * 0.6)
    const charBudget = tokenBudget * 4
    let source = editorContent
    if (source.length > charBudget) {
      source = source.slice(0, charBudget) + '\n... [truncated]'
    }
    sections.push(
      `<current_file name="${activeFileName || 'untitled.scad'}">\n${source}\n</current_file>`
    )
  }

  // Compiler errors
  if (compilerErrors.length > 0) {
    const errorLines = compilerErrors.map(
      (e) => `  <error line="${e.line}" col="${e.column}" severity="${e.severity}">${e.message}</error>`
    )
    sections.push(`<compiler_errors>\n${errorLines.join('\n')}\n</compiler_errors>`)
  }

  // Model dimensions from viewer
  if (modelBounds) {
    const [minX, minY, minZ] = modelBounds.min
    const [maxX, maxY, maxZ] = modelBounds.max
    const width = (maxX - minX).toFixed(2)
    const height = (maxY - minY).toFixed(2)
    const depth = (maxZ - minZ).toFixed(2)
    sections.push(
      `<model_dimensions width="${width}" height="${height}" depth="${depth}" unit="mm" />`
    )
  }

  if (sections.length === 0) return ''

  return `\n\nThe user is currently working in ClawdCAD. Here is their current context:\n\n${sections.join('\n\n')}`
}

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [applyDialog, setApplyDialog] = useState<{ code: string; mode: 'replace' | 'insert' } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatStore = useChatStore()
  const editorStore = useEditorStore()
  const compilerStore = useCompilerStore()
  const viewerStore = useViewerStore()
  const settingsStore = useSettingsStore()
  const projectStore = useProjectStore()

  const activeFileName = editorStore.activeFilePath
  const pendingImages = chatStore.pendingImages

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file || file.size > MAX_IMAGE_BYTES) return
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const commaIdx = dataUrl.indexOf(',')
          if (commaIdx < 0) return
          const base64 = dataUrl.slice(commaIdx + 1)
          const attachment: ImageAttachment = {
            id: crypto.randomUUID(),
            data: base64,
            mediaType: item.type,
          }
          useChatStore.getState().addPendingImage(attachment)
        }
        reader.readAsDataURL(file)
        return // handle first image item only per paste event
      }
    }
  }, [])

  /**
   * Apply code to editor: replace entire content or insert at cursor.
   * Marks file as dirty and triggers auto-compile if enabled.
   */
  const applyCodeToEditor = useCallback((code: string, mode: 'replace' | 'insert') => {
    if (mode === 'replace') {
      editorStore.setEditorContent(code)
    } else {
      // Insert at cursor: splice code into current content at cursor position
      const content = editorStore.editorContent
      const lines = content.split('\n')
      const line = editorStore.cursorLine - 1
      const col = editorStore.cursorColumn - 1
      if (line < lines.length) {
        const currentLine = lines[line]
        lines[line] = currentLine.slice(0, col) + code + currentLine.slice(col)
      } else {
        lines.push(code)
      }
      editorStore.setEditorContent(lines.join('\n'))
    }

    // Mark active file as dirty
    if (editorStore.activeFilePath) {
      editorStore.markDirty(editorStore.activeFilePath, true)
    }

    // Trigger auto-compile if enabled
    if (settingsStore.preferences.editor.autoCompile) {
      const source = mode === 'replace' ? code : useEditorStore.getState().editorContent
      compilerStore.setCompiling(true)
      compilerStore.clearErrors()
      compilerStore.setLastCompiledSource(source)
      if (window.electronAPI?.openscad) {
        window.electronAPI.openscad.compile(source).then((result) => {
          compilerStore.setCompileResult(result)
        }).catch(() => {
          compilerStore.setCompileResult({ success: false, stlBuffer: null, offData: null, stderr: 'Compile failed', duration: 0 })
        })
      } else {
        // Browser mode: simulate compile success
        setTimeout(() => {
          compilerStore.setCompileResult({ success: true, stlBuffer: null, offData: null, stderr: '', duration: 100 })
        }, 300)
      }
    }
  }, [editorStore, compilerStore, settingsStore.preferences.editor.autoCompile])

  const handleApplyCode = useCallback((code: string) => {
    setApplyDialog({ code, mode: 'replace' })
  }, [])

  const handleInsertCode = useCallback((code: string) => {
    setApplyDialog({ code, mode: 'insert' })
  }, [])

  const handleConfirmApply = useCallback(() => {
    if (applyDialog) {
      applyCodeToEditor(applyDialog.code, applyDialog.mode)
      setApplyDialog(null)
    }
  }, [applyDialog, applyCodeToEditor])

  const codeBlockActions: CodeBlockActions = {
    onApply: handleApplyCode,
    onInsert: handleInsertCode,
    onCopy: () => {},
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatStore.messages, chatStore.streamingContent])

  // Set up IPC stream listeners
  useEffect(() => {
    if (!window.electronAPI?.ai) return

    const cleanupToken = window.electronAPI.ai.onStreamToken((token) => {
      useChatStore.getState().appendToken(token)
    })
    const cleanupEnd = window.electronAPI.ai.onStreamEnd(async () => {
      // Reload active file from disk BEFORE finishStreaming() so the editor
      // is up-to-date when isStreaming flips to false (prevents auto-compile
      // from recompiling stale editor content)
      const activeFile = useEditorStore.getState().activeFilePath
      if (activeFile && window.electronAPI?.file) {
        try {
          const result = await window.electronAPI.file.read(activeFile)
          if (!result.error) {
            const currentContent = useEditorStore.getState().editorContent
            if (result.content !== currentContent) {
              useEditorStore.getState().setEditorContent(result.content)
              useEditorStore.getState().markDirty(activeFile, false)
            }
          }
        } catch { /* ignore read errors */ }
      }

      chatStore.finishStreaming()
    })
    const cleanupError = window.electronAPI.ai.onStreamError((error) => {
      chatStore.setError(error)
    })

    return () => {
      cleanupToken()
      cleanupEnd()
      cleanupError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tool call and checkpoint IPC listeners
  useEffect(() => {
    if (!window.electronAPI?.ai) return

    const cleanupToolStart = window.electronAPI.ai.onToolCallStart((toolCall) => {
      console.log('[ChatPanel] IPC tool-call-start received:', toolCall)
      useChatStore.getState().addToolCall(toolCall as ToolCallBlock)
    })
    const cleanupToolResult = window.electronAPI.ai.onToolCallResult((result) => {
      console.log('[ChatPanel] IPC tool-call-result received:', result)
      useChatStore.getState().addToolResult(result as ToolResultBlock)
    })
    const cleanupCheckpoint = window.electronAPI.ai.onCheckpointCreated((checkpoint) => {
      chatStore.addCheckpoint(checkpoint as Checkpoint)
    })
    const cleanupCompileResult = window.electronAPI.ai.onCompileResult((result, source) => {
      useCompilerStore.getState().setCompileResult(result)
      useCompilerStore.getState().setLastCompiledSource(source)
    })
    const cleanupViewport = window.electronAPI.ai.onViewportCaptured?.((imageData) => {
      useChatStore.getState().setToolCallImage(imageData)
    })

    return () => {
      cleanupToolStart()
      cleanupToolResult()
      cleanupCheckpoint()
      cleanupCompileResult()
      cleanupViewport?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || chatStore.isStreaming) return

    const images = pendingImages.length > 0 ? [...pendingImages] : undefined
    chatStore.addUserMessage(trimmed, images)
    setInput('')
    chatStore.clearPendingImages()
    chatStore.startStreaming()

    // Build messages array for API — include images on last user message
    const apiMessages = [
      ...chatStore.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed, ...(images && { images }) },
    ]

    // Derive project dir from active file when no project is open
    let effectiveProjectDir = projectStore.projectPath
    if (!effectiveProjectDir && editorStore.activeFilePath) {
      const filePath = editorStore.activeFilePath.replace(/\\/g, '/')
      const lastSlash = filePath.lastIndexOf('/')
      if (lastSlash > 0) {
        effectiveProjectDir = filePath.substring(0, lastSlash)
      }
    }

    // Build system prompt with context
    const freshContext = buildContext(
      editorStore.editorContent,
      editorStore.activeFilePath,
      compilerStore.errors,
      viewerStore.modelBounds,
      settingsStore.preferences.chat.maxTokens,
    )
    const systemPrompt = `You are an expert OpenSCAD assistant in ClawdCAD with direct access to the user's project files. When the user asks you to modify, fix, or create code, use your tools (read_file, write_file, edit_file, compile) to make changes directly. Do not just show code in chat — apply it to the files. After making changes, compile to verify correctness.${freshContext}`

    if (window.electronAPI?.ai) {
      try {
        await window.electronAPI.ai.sendMessage(apiMessages, systemPrompt, effectiveProjectDir || undefined)
      } catch (err) {
        const errObj = err as { message?: string }
        chatStore.setError(errObj?.message || 'Failed to send message')
      }
    } else {
      // Browser mode: simulate response showing context info
      setTimeout(() => {
        chatStore.appendToken('Running in browser mode. ')
        setTimeout(() => {
          chatStore.appendToken('Connect via Electron with an API key to use AI features.')
          if (freshContext) {
            setTimeout(() => {
              chatStore.appendToken(`\n\n_Context included: ${freshContext.length > 0 ? 'editor source' : 'none'}${compilerStore.errors.length > 0 ? ', compiler errors' : ''}${viewerStore.modelBounds ? ', model dimensions' : ''}_`)
              setTimeout(() => chatStore.finishStreaming(), 100)
            }, 200)
          } else {
            setTimeout(() => chatStore.finishStreaming(), 100)
          }
        }, 200)
      }, 300)
    }
  }, [input, chatStore, pendingImages, editorStore.editorContent, editorStore.activeFilePath, compilerStore.errors, viewerStore.modelBounds, settingsStore.preferences.chat.maxTokens, projectStore.projectPath])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full" data-testid="chat-panel">
      {/* Apply Code Confirmation Dialog */}
      {applyDialog && (
        <ApplyCodeDialog
          oldCode={editorStore.editorContent}
          newCode={applyDialog.code}
          mode={applyDialog.mode}
          onConfirm={handleConfirmApply}
          onCancel={() => setApplyDialog(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">AI ASSISTANT</h2>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-2 py-1 rounded ${
              showContext
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            onClick={() => setShowContext(!showContext)}
            data-testid="context-toggle"
            title="Show AI context"
          >
            📎 Context
          </button>
          <button
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => chatStore.clearConversation()}
            data-testid="clear-chat"
            title="Clear conversation"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Context Indicator Panel */}
      {showContext && (
        <div className="px-3 py-2 bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs space-y-1" data-testid="context-panel">
          <div className="text-gray-500 dark:text-gray-400 font-semibold mb-1">Included Context:</div>
          <div className="flex items-center gap-1">
            <span className={editorStore.editorContent ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}>
              {editorStore.editorContent ? '✓' : '✕'}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Editor source ({activeFileName || 'none'})
              {editorStore.editorContent && (
                <span className="text-gray-400 dark:text-gray-600 ml-1">
                  ({editorStore.editorContent.split('\n').length} lines)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={compilerStore.errors.length > 0 ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-600'}>
              {compilerStore.errors.length > 0 ? '✓' : '✕'}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Compiler errors
              {compilerStore.errors.length > 0 && (
                <span className="text-yellow-400 ml-1">({compilerStore.errors.length})</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={viewerStore.modelBounds ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}>
              {viewerStore.modelBounds ? '✓' : '✕'}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Model dimensions
              {viewerStore.modelBounds && (() => {
                const b = viewerStore.modelBounds!
                return (
                  <span className="text-gray-400 dark:text-gray-600 ml-1">
                    ({(b.max[0] - b.min[0]).toFixed(1)} × {(b.max[1] - b.min[1]).toFixed(1)} × {(b.max[2] - b.min[2]).toFixed(1)} mm)
                  </span>
                )
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3" data-testid="chat-messages">
        {chatStore.messages.length === 0 && !chatStore.isStreaming && (
          <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-8">
            <div className="text-2xl mb-2">🤖</div>
            <p>Ask me about OpenSCAD!</p>
            <p className="text-xs mt-1 text-gray-400 dark:text-gray-600">
              I can generate code, explain concepts, fix errors, and edit your project files.
            </p>
          </div>
        )}
        {chatStore.messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} codeActions={msg.role === 'assistant' ? codeBlockActions : undefined} />
        ))}
        {chatStore.isStreaming && <StreamingBubble content={chatStore.streamingContent} />}
        {/* Checkpoint banners */}
        {chatStore.checkpoints.map((cp) => (
          <CheckpointBanner
            key={cp.id}
            checkpoint={cp}
            onUndo={(id) => {
              const projDir = projectStore.projectPath
              if (projDir && window.electronAPI?.checkpoint) {
                window.electronAPI.checkpoint.undo(projDir, id)
              }
            }}
          />
        ))}
        {chatStore.error && (
          <div className="bg-red-100/30 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded px-3 py-2 text-sm text-red-700 dark:text-red-300 mb-3" data-testid="chat-error">
            {chatStore.error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2" data-testid="chat-input-area">
        {/* Pending images preview strip */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2" data-testid="pending-images">
            {pendingImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt="Pending"
                  className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-600"
                />
                <button
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => chatStore.removePendingImage(img.id)}
                  title="Remove image"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
            rows={2}
            placeholder="Ask about OpenSCAD... (Ctrl+Enter to send, paste images)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={chatStore.isStreaming}
            data-testid="chat-input"
          />
          <button
            className={`px-3 py-2 rounded text-sm font-medium self-end ${
              chatStore.isStreaming || !input.trim()
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            onClick={sendMessage}
            disabled={chatStore.isStreaming || !input.trim()}
            data-testid="chat-send"
          >
            Send
          </button>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-600 mt-1">Ctrl+Enter to send</div>
      </div>
    </div>
  )
}
