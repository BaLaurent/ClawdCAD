import { create } from 'zustand'
import type { editor } from 'monaco-editor'

export interface OpenFile {
  path: string
  name: string
  content: string
  isDirty: boolean
}

interface EditorState {
  openFiles: OpenFile[]
  activeFilePath: string | null
  editorContent: string
  cursorLine: number
  cursorColumn: number
  monacoEditorInstance: editor.IStandaloneCodeEditor | null
  canUndo: boolean
  canRedo: boolean

  setEditorContent: (content: string) => void
  openFile: (file: OpenFile) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  markDirty: (path: string, dirty: boolean) => void
  setCursorPosition: (line: number, column: number) => void
  setMonacoEditorInstance: (instance: editor.IStandaloneCodeEditor | null) => void
  setCanUndo: (value: boolean) => void
  setCanRedo: (value: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  openFiles: [],
  activeFilePath: null,
  editorContent: '',
  cursorLine: 1,
  cursorColumn: 1,
  monacoEditorInstance: null,
  canUndo: false,
  canRedo: false,

  setEditorContent: (content) =>
    set((state) => {
      const activeFile = state.openFiles.find((f) => f.path === state.activeFilePath)
      if (!activeFile) return { editorContent: content }
      return {
        editorContent: content,
        openFiles: state.openFiles.map((f) =>
          f.path === state.activeFilePath ? { ...f, content, isDirty: true } : f
        ),
      }
    }),

  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.find((f) => f.path === file.path)
      if (exists) {
        return { activeFilePath: file.path, editorContent: exists.content }
      }
      return {
        openFiles: [...state.openFiles, file],
        activeFilePath: file.path,
        editorContent: file.content,
      }
    }),

  closeFile: (path) =>
    set((state) => {
      const remaining = state.openFiles.filter((f) => f.path !== path)
      const newActive = state.activeFilePath === path
        ? remaining[remaining.length - 1]?.path ?? null
        : state.activeFilePath
      const newContent = newActive
        ? remaining.find((f) => f.path === newActive)?.content ?? ''
        : ''
      return {
        openFiles: remaining,
        activeFilePath: newActive,
        editorContent: newContent,
      }
    }),

  setActiveFile: (path) =>
    set((state) => {
      const file = state.openFiles.find((f) => f.path === path)
      return {
        activeFilePath: path,
        editorContent: file?.content ?? '',
      }
    }),

  markDirty: (path, dirty) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty: dirty } : f
      ),
    })),

  setCursorPosition: (line, column) => set({ cursorLine: line, cursorColumn: column }),

  setMonacoEditorInstance: (instance) => set({ monacoEditorInstance: instance }),

  setCanUndo: (value) => set({ canUndo: value }),
  setCanRedo: (value) => set({ canRedo: value }),
}))
