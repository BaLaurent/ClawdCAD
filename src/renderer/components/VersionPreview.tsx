import { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import * as monaco from 'monaco-editor'
import { useGitStore } from '../stores/gitStore'
import { useEditorStore } from '../stores/editorStore'
import { useSettingsStore } from '../stores/settingsStore'
import { isAsciiSTL, parseSTLAscii, parseSTLBinary, parseOFF } from '../utils/geometryParsers'
import type { CompileResult } from '../../shared/types'

function getLanguageFromPath(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    scad: 'cpp',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
  }
  return ext ? (map[ext] || 'plaintext') : 'plaintext'
}

function MiniScene({ geometry }: { geometry: THREE.BufferGeometry | null }) {
  const meshRef = useRef<THREE.Mesh>(null)

  /* eslint-disable react/no-unknown-property */
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} />
      <gridHelper args={[100, 20, '#555555', '#333333']} />
      {geometry && (
        <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            color="#4fc3f7"
            roughness={0.5}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <OrbitControls enableDamping dampingFactor={0.1} />
    </>
  )
  /* eslint-enable react/no-unknown-property */
}

export default function VersionPreview() {
  const gitStore = useGitStore()
  const editorStore = useEditorStore()
  const editorTheme = useSettingsStore((s) => s.preferences.editor.theme)
  const { versionPreview } = gitStore
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)

  const isScadFile = versionPreview.filepath.toLowerCase().endsWith('.scad')

  // Create read-only Monaco editor
  useEffect(() => {
    if (!containerRef.current || !versionPreview.isOpen || versionPreview.isLoading) return

    const editor = monaco.editor.create(containerRef.current, {
      value: versionPreview.content,
      language: getLanguageFromPath(versionPreview.filepath),
      readOnly: true,
      theme: editorTheme === 'dark' ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
    })

    editorRef.current = editor

    return () => {
      editor.dispose()
      editorRef.current = null
    }
  }, [versionPreview.isOpen, versionPreview.isLoading, versionPreview.content, versionPreview.filepath, editorTheme])

  // Auto-compile .scad files for 3D preview
  useEffect(() => {
    if (!versionPreview.isOpen || versionPreview.isLoading || !isScadFile) return
    if (!versionPreview.content || !window.electronAPI?.openscad) return

    let cancelled = false
    setIsCompiling(true)
    setCompileError(null)

    window.electronAPI.openscad.compile(versionPreview.content).then((result: CompileResult) => {
      if (cancelled) return
      setIsCompiling(false)

      if (!result.success) {
        setCompileError(result.stderr)
        setGeometry(null)
        return
      }

      try {
        // Try OFF first for colors
        if (result.offData) {
          try {
            const geo = parseOFF(result.offData)
            setGeometry(geo)
            return
          } catch {
            // fall through to STL
          }
        }

        if (result.stlBuffer) {
          const isAscii = isAsciiSTL(result.stlBuffer)
          const geo = isAscii ? parseSTLAscii(result.stlBuffer) : parseSTLBinary(result.stlBuffer)
          setGeometry(geo)
        } else {
          setGeometry(null)
        }
      } catch (err) {
        setCompileError(err instanceof Error ? err.message : String(err))
        setGeometry(null)
      }
    }).catch((err: unknown) => {
      if (cancelled) return
      setIsCompiling(false)
      setCompileError(err instanceof Error ? err.message : String(err))
    })

    return () => { cancelled = true }
  }, [versionPreview.isOpen, versionPreview.isLoading, versionPreview.content, isScadFile])

  const handleRevert = useCallback(() => {
    const activeFile = editorStore.openFiles.find(f => f.path === editorStore.activeFilePath)
    if (activeFile?.isDirty) {
      const confirmed = window.confirm(
        'The current file has unsaved changes. Reverting will replace the editor content. Continue?'
      )
      if (!confirmed) return
    }

    editorStore.setEditorContent(versionPreview.content)
    gitStore.closeVersionPreview()
  }, [editorStore, gitStore, versionPreview.content])

  if (!versionPreview.isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-50" data-testid="version-preview">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">VERSION</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{versionPreview.filepath}</span>
          <span className="text-xs text-blue-400 font-mono shrink-0">@ {versionPreview.oid.slice(0, 7)}</span>
          <span className="text-xs text-gray-500 truncate">&mdash; {versionPreview.commitMessage}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="text-xs px-3 py-1.5 rounded font-medium bg-purple-600 hover:bg-purple-500 text-white"
            onClick={handleRevert}
            data-testid="version-revert"
            title="Load this version into the editor (as unsaved change)"
          >
            Revert to This
          </button>
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
            onClick={() => gitStore.closeVersionPreview()}
            data-testid="version-close"
          >
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Monaco Editor (read-only) */}
        <div className={`${isScadFile ? 'w-1/2' : 'w-full'} flex flex-col min-h-0`}>
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1 text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
            Historical Source (Read-only)
          </div>
          {versionPreview.isLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent mr-2" />
              Loading...
            </div>
          ) : (
            <div className="flex-1" ref={containerRef} data-testid="version-editor" />
          )}
        </div>

        {/* 3D Preview (only for .scad files) */}
        {isScadFile && (
          <div className="w-1/2 flex flex-col border-l border-gray-200 dark:border-gray-700 min-h-0">
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1 text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              3D Preview
              {isCompiling && (
                <span className="text-cyan-400 flex items-center gap-1">
                  <span className="animate-spin rounded-full h-3 w-3 border border-cyan-400 border-t-transparent" />
                  Compiling...
                </span>
              )}
            </div>
            <div className="flex-1 relative" style={{ background: '#1a1a2e' }}>
              {compileError && !isCompiling && (
                <div className="absolute top-2 left-2 right-2 bg-red-900/80 text-red-300 text-xs px-3 py-2 rounded z-10 max-h-24 overflow-auto">
                  {compileError}
                </div>
              )}
              {!versionPreview.isLoading && (
                <Canvas
                  camera={{ fov: 50, near: 0.1, far: 1000, position: [50, 50, 50] }}
                  gl={{ antialias: true, failIfMajorPerformanceCaveat: false }}
                >
                  <MiniScene geometry={geometry} />
                </Canvas>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
