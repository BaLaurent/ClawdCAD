import { useRef, useEffect } from 'react'
import { useGitStore } from '../stores/gitStore'
import { useSettingsStore } from '../stores/settingsStore'
import * as monaco from 'monaco-editor'

function getLanguageFromPath(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    scad: 'cpp', // OpenSCAD syntax is C-like
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell',
  }
  return ext ? (map[ext] || 'plaintext') : 'plaintext'
}

export default function DiffViewer() {
  const gitStore = useGitStore()
  const editorTheme = useSettingsStore((s) => s.preferences.editor.theme)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)

  useEffect(() => {
    if (!containerRef.current || !gitStore.diff.isOpen) return

    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      originalEditable: false,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      theme: editorTheme === 'dark' ? 'vs-dark' : 'vs',
    })

    const language = getLanguageFromPath(gitStore.diff.filepath)
    const originalModel = monaco.editor.createModel(gitStore.diff.original, language)
    const modifiedModel = monaco.editor.createModel(gitStore.diff.modified, language)

    editor.setModel({
      original: originalModel,
      modified: modifiedModel,
    })

    editorRef.current = editor

    return () => {
      editor.dispose()
      originalModel.dispose()
      modifiedModel.dispose()
      editorRef.current = null
    }
  }, [gitStore.diff.isOpen, gitStore.diff.original, gitStore.diff.modified, gitStore.diff.filepath, editorTheme])

  if (!gitStore.diff.isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-50" data-testid="diff-viewer">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">DIFF</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{gitStore.diff.filepath}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {gitStore.diff.isStaged ? 'Staged (HEAD vs Index)' : 'Unstaged (HEAD vs Working)'}
          </span>
          <span className="text-xs text-gray-500">Read-only</span>
        </div>
        <button
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
          onClick={() => gitStore.closeDiff()}
          data-testid="diff-close"
        >
          ✕ Close
        </button>
      </div>

      {/* Labels */}
      <div className="bg-white dark:bg-gray-800 flex border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1 px-4 py-1 text-xs text-red-400 border-r border-gray-200 dark:border-gray-700">
          Original (HEAD)
        </div>
        <div className="flex-1 px-4 py-1 text-xs text-green-400">
          Modified (Working Tree)
        </div>
      </div>

      {/* Monaco Diff Editor */}
      <div className="flex-1" ref={containerRef} data-testid="diff-editor" />
    </div>
  )
}
