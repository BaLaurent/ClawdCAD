import { useEffect, useRef, useCallback } from 'react'
import { useCompilerStore } from '../stores/compilerStore'
import { useEditorStore } from '../stores/editorStore'

export default function ConsolePanel() {
  const { consoleEntries, clearConsole, compileStatus, compileDuration } = useCompilerStore()
  const editorStore = useEditorStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [consoleEntries])

  const handleErrorClick = useCallback((text: string) => {
    // Extract line number from error text and jump to it
    const lineMatch = text.match(/line\s+(\d+)/i)
    if (lineMatch) {
      const line = parseInt(lineMatch[1], 10)
      editorStore.setCursorPosition(line, 1)
    }
  }, [editorStore])

  const colorForType = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      case 'echo': return 'text-cyan-400'
      default: return 'text-gray-700 dark:text-gray-300'
    }
  }

  const iconForType = (type: string) => {
    switch (type) {
      case 'error': return '✕'
      case 'warning': return '⚠'
      case 'echo': return '▸'
      default: return '·'
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full" data-testid="console-panel">
      {/* Console Header */}
      <div className="flex items-center px-4 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          CONSOLE
          {consoleEntries.length > 0 && (
            <span className="ml-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-xs" data-testid="console-entry-count">
              {consoleEntries.length}
            </span>
          )}
        </h2>
        {compileStatus !== 'idle' && compileDuration > 0 && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500" data-testid="console-compile-duration">
            {compileDuration}ms
          </span>
        )}
        <button
          className="ml-auto text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-0.5"
          onClick={clearConsole}
          data-testid="console-clear"
          title="Clear console"
        >
          Clear
        </button>
      </div>

      {/* Console Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-1 font-mono text-xs"
        data-testid="console-output"
      >
        {consoleEntries.length === 0 ? (
          <div className="text-gray-400 dark:text-gray-500 py-1">No output yet. Compile to see results.</div>
        ) : (
          consoleEntries.map((entry, i) => (
            <div
              key={i}
              className={`py-0.5 flex items-start gap-2 ${colorForType(entry.type)} ${
                entry.type === 'error' ? 'cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50' : ''
              }`}
              data-testid="console-entry"
              onClick={entry.type === 'error' ? () => handleErrorClick(entry.text) : undefined}
            >
              <span className="text-gray-600 shrink-0 select-none">{formatTime(entry.timestamp)}</span>
              <span className="shrink-0">{iconForType(entry.type)}</span>
              <span className="break-all">{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
