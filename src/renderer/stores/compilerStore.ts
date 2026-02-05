import { create } from 'zustand'
import type { CompileResult } from '@shared/types'

export type { CompileResult }

export interface CompilerError {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}

type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'

interface ConsoleEntry {
  timestamp: number
  text: string
  type: 'error' | 'warning' | 'echo' | 'info'
}

interface CompilerState {
  isCompiling: boolean
  compileStatus: CompileStatus
  errors: CompilerError[]
  lastStl: ArrayBuffer | null
  lastOff: string | null
  compileDuration: number
  lastStderr: string
  lastCompiledSource: string
  consoleEntries: ConsoleEntry[]

  setCompiling: (compiling: boolean) => void
  setCompileResult: (result: CompileResult) => void
  clearErrors: () => void
  setLastCompiledSource: (source: string) => void
  clearConsole: () => void
}

/**
 * Parse OpenSCAD stderr to extract error locations.
 * OpenSCAD errors look like:
 *   ERROR: Parser error in line 12: syntax error
 *   WARNING: Ignoring unknown variable "foo" in file ..., line 5
 *   ERROR: Parser error: syntax error, unexpected '}', expecting ';' in file ..., line 23
 */
export function parseOpenScadErrors(stderr: string): CompilerError[] {
  const errors: CompilerError[] = []
  const lines = stderr.split('\n')

  for (const line of lines) {
    // Pattern: ERROR: ... in line X
    // Pattern: ERROR: ... line X
    // Pattern: WARNING: ... line X
    const errorMatch = line.match(/^(ERROR|WARNING):\s*(.*?)(?:,\s*)?(?:in\s+)?line\s+(\d+)/i)
    if (errorMatch) {
      const severity = errorMatch[1].toUpperCase() === 'WARNING' ? 'warning' as const : 'error' as const
      const message = errorMatch[2].trim().replace(/,\s*$/, '')
      const lineNum = parseInt(errorMatch[3], 10)
      errors.push({ line: lineNum, column: 1, message, severity })
      continue
    }

    // Pattern: ERROR: Parser error in line X: message
    const parserMatch = line.match(/^ERROR:\s*Parser error in line (\d+):\s*(.*)/i)
    if (parserMatch) {
      errors.push({
        line: parseInt(parserMatch[1], 10),
        column: 1,
        message: parserMatch[2].trim(),
        severity: 'error',
      })
      continue
    }

    // Fallback: any ERROR line without line number
    const genericError = line.match(/^ERROR:\s*(.*)/i)
    if (genericError && !errors.some(e => genericError[1].includes(e.message))) {
      errors.push({
        line: 1,
        column: 1,
        message: genericError[1].trim(),
        severity: 'error',
      })
    }
  }

  return errors
}

function parseConsoleOutput(stderr: string): ConsoleEntry[] {
  const now = Date.now()
  const lines = stderr.split('\n').filter(l => l.trim())
  return lines.map(line => {
    let type: ConsoleEntry['type'] = 'info'
    if (/^ERROR:/i.test(line)) type = 'error'
    else if (/^WARNING:/i.test(line)) type = 'warning'
    else if (/^ECHO:/i.test(line)) type = 'echo'
    return { timestamp: now, text: line, type }
  })
}

export const useCompilerStore = create<CompilerState>((set) => ({
  isCompiling: false,
  compileStatus: 'idle',
  errors: [],
  lastStl: null,
  lastOff: null,
  compileDuration: 0,
  lastStderr: '',
  lastCompiledSource: '',
  consoleEntries: [],

  setCompiling: (compiling) => set({
    isCompiling: compiling,
    compileStatus: compiling ? 'compiling' : 'idle',
  }),

  setCompileResult: (result) => {
    const errors = result.success ? [] : parseOpenScadErrors(result.stderr)
    const newEntries = parseConsoleOutput(result.stderr)

    // Ensure we have a proper ArrayBuffer for Three.js
    // Electron IPC may deliver ArrayBuffer, Uint8Array, or serialized Buffer
    let stl: ArrayBuffer | null = null
    if (result.stlBuffer) {
      if (result.stlBuffer instanceof ArrayBuffer) {
        stl = result.stlBuffer
      } else if (ArrayBuffer.isView(result.stlBuffer)) {
        // Use .slice() to ensure we get an ArrayBuffer, not SharedArrayBuffer
        const view = result.stlBuffer as Uint8Array
        stl = view.slice(0).buffer
      } else {
        console.error('[compilerStore] STL buffer unexpected type:', typeof result.stlBuffer)
      }
    }

    set({
      isCompiling: false,
      compileStatus: result.success ? 'success' : 'error',
      errors,
      lastStl: stl,
      lastOff: result.offData ?? null,
      compileDuration: result.duration,
      lastStderr: result.stderr,
      consoleEntries: newEntries,
    })
  },

  clearErrors: () => set({ errors: [] }),

  setLastCompiledSource: (source) => set({ lastCompiledSource: source }),

  clearConsole: () => set({ consoleEntries: [] }),
}))
