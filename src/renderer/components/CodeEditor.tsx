import { useRef, useCallback, useEffect } from 'react'
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { registerOpenSCADLanguage } from '../openscad-language'
import { useEditorStore } from '../stores/editorStore'
import { useCompilerStore, CompilerError } from '../stores/compilerStore'
import { useSettingsStore } from '../stores/settingsStore'

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  fontSize?: number
  tabSize?: number
}

export default function CodeEditor({ value, onChange, language = 'openscad', readOnly = false, fontSize = 14, tabSize = 4 }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition)
  const setMonacoEditorInstance = useEditorStore((s) => s.setMonacoEditorInstance)
  const setCanUndo = useEditorStore((s) => s.setCanUndo)
  const setCanRedo = useEditorStore((s) => s.setCanRedo)
  const compilerErrors = useCompilerStore((s) => s.errors)
  const editorTheme = useSettingsStore((s) => s.preferences.editor.theme)

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco as typeof import('monaco-editor')
    registerOpenSCADLanguage(monaco)
  }, [])

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.focus()

    // Store editor instance in global store for menu actions
    setMonacoEditorInstance(editor)

    // Track undo/redo availability from model content changes
    editor.onDidChangeModelContent((e) => {
      if (e.isUndoing) {
        setCanRedo(true)
      } else if (e.isRedoing) {
        setCanUndo(true)
      } else {
        // Normal edit: can undo, redo stack is cleared
        setCanUndo(true)
        setCanRedo(false)
      }
    })

    // Track cursor position changes for status bar
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column)
    })

    // Set initial cursor position
    const pos = editor.getPosition()
    if (pos) {
      setCursorPosition(pos.lineNumber, pos.column)
    }
  }, [setCursorPosition, setMonacoEditorInstance, setCanUndo, setCanRedo])

  // Update cursor position and reset undo/redo state when switching tabs
  useEffect(() => {
    if (editorRef.current) {
      const pos = editorRef.current.getPosition()
      if (pos) {
        setCursorPosition(pos.lineNumber, pos.column)
      }
    }
    setCanUndo(false)
    setCanRedo(false)
  }, [value, setCursorPosition, setCanUndo, setCanRedo])

  // Set Monaco error markers from compiler errors
  useEffect(() => {
    const monaco = monacoRef.current
    const editorInstance = editorRef.current
    if (!monaco || !editorInstance) return

    const model = editorInstance.getModel()
    if (!model) return

    const markers = compilerErrors.map((err: CompilerError) => ({
      severity: err.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Error,
      startLineNumber: err.line,
      startColumn: err.column,
      endLineNumber: err.line,
      endColumn: model.getLineMaxColumn(err.line) || 1,
      message: err.message,
      source: 'OpenSCAD',
    }))

    monaco.editor.setModelMarkers(model, 'openscad', markers)
  }, [compilerErrors])

  const handleChange = useCallback((val: string | undefined) => {
    if (onChange && val !== undefined) {
      onChange(val)
    }
  }, [onChange])

  return (
    <div className="h-full w-full" data-testid="code-editor">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        theme={editorTheme === 'dark' ? 'vs-dark' : 'vs'}
        options={{
          fontSize,
          tabSize,
          insertSpaces: true,
          autoIndent: 'full',
          // Minimap
          minimap: {
            enabled: true,
            side: 'right',
            showSlider: 'always',
            renderCharacters: true,
            maxColumn: 120,
          },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          padding: { top: 8 },
          // Code folding
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          foldingHighlight: true,
          // Bracket matching and auto-close
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          matchBrackets: 'always',
          bracketPairColorization: { enabled: true },
          // Auto-complete / suggestions
          quickSuggestions: { other: true, comments: false, strings: false },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          snippetSuggestions: 'inline',
          suggest: {
            showKeywords: true,
            showFunctions: true,
            showModules: true,
            showVariables: true,
            insertMode: 'insert',
          },
          // Find and replace
          find: {
            addExtraSpaceOnTop: true,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always',
          },
        }}
      />
    </div>
  )
}
