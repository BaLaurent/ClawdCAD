import { useRef, useState, useEffect } from 'react'
import { useViewerStore } from '../stores/viewerStore'
import { useCompilerStore } from '../stores/compilerStore'

interface Toast {
  message: string
  type: 'success' | 'error'
}

export default function ViewerToolbar() {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const { wireframe, setWireframe, meshColor, setMeshColor, geometry, useOriginalColors, setUseOriginalColors, hasVertexColors } = useViewerStore()
  const lastStl = useCompilerStore((s) => s.lastStl)
  const hasModel = !!geometry
  const [toast, setToast] = useState<Toast | null>(null)

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleScreenshot = async () => {
    const canvas = document.querySelector('[data-testid="viewer-canvas"] canvas') as HTMLCanvasElement | null
    if (!canvas) return
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png')
      })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      showToast('Screenshot copied to clipboard', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showToast(`Screenshot failed: ${message}`, 'error')
    }
  }

  const handleExportStl = async () => {
    if (!lastStl) return
    try {
      const result = await window.electronAPI.file.saveStl(lastStl)
      if (result.success) {
        showToast(`STL exported to ${result.filePath}`, 'success')
      } else if (result.error) {
        showToast(`Export failed: ${result.error}`, 'error')
      }
      // User cancelled dialog - no toast needed
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showToast(`Export failed: ${message}`, 'error')
    }
  }

  return (
    <>
      <div
        className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 z-10"
        data-testid="viewer-toolbar"
      >
        {/* Wireframe Toggle */}
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`p-1.5 rounded text-xs transition-colors ${
            wireframe
              ? 'bg-blue-600 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={wireframe ? 'Switch to solid' : 'Switch to wireframe'}
          data-testid="viewer-wireframe-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="2" width="12" height="12" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="8" y1="2" x2="8" y2="14" />
            <line x1="2" y1="2" x2="14" y2="14" />
            <line x1="14" y1="2" x2="2" y2="14" />
          </svg>
        </button>

        {/* Original Colors Toggle */}
        <button
          onClick={() => setUseOriginalColors(!useOriginalColors)}
          disabled={!hasVertexColors}
          className={`p-1.5 rounded text-xs transition-colors ${
            !hasVertexColors
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : useOriginalColors
                ? 'bg-purple-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={!hasVertexColors ? 'No color data — use color() in OpenSCAD' : (useOriginalColors ? 'Switch to uniform color' : 'Show original colors')}
          data-testid="viewer-original-colors-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="6" cy="7" r="3" />
            <circle cx="10" cy="7" r="3" />
            <circle cx="8" cy="10.5" r="3" />
          </svg>
        </button>

        {/* Color Picker */}
        <div className="relative">
          <button
            onClick={() => colorInputRef.current?.click()}
            disabled={useOriginalColors && hasVertexColors}
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              useOriginalColors && hasVertexColors
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={useOriginalColors && hasVertexColors ? 'Disable original colors to change mesh color' : 'Change mesh color'}
            data-testid="viewer-color-picker"
          >
            <div
              className="w-4 h-4 rounded border border-gray-400 dark:border-gray-500"
              style={{ backgroundColor: meshColor }}
            />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            value={meshColor}
            onChange={(e) => setMeshColor(e.target.value)}
            className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
            data-testid="viewer-color-input"
          />
        </div>

        {/* Screenshot Button */}
        <button
          onClick={handleScreenshot}
          className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Take screenshot"
          data-testid="viewer-screenshot-btn"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1" y="3" width="14" height="10" rx="1" />
            <circle cx="8" cy="8.5" r="2.5" />
            <rect x="5" y="1" width="6" height="3" rx="0.5" />
          </svg>
        </button>

        {/* Export STL Button */}
        <button
          onClick={handleExportStl}
          disabled={!hasModel}
          className={`p-1.5 rounded transition-colors ${
            hasModel
              ? 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }`}
          title={hasModel ? 'Export STL file' : 'No model loaded'}
          data-testid="viewer-export-stl-btn"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M8 2v8M5 7l3 3 3-3" />
            <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
          </svg>
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`absolute bottom-2 right-2 z-20 px-3 py-2 rounded-lg text-xs font-medium border ${
            toast.type === 'success'
              ? 'bg-green-100/80 dark:bg-green-900/80 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
              : 'bg-red-100/80 dark:bg-red-900/80 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
          }`}
          data-testid="viewer-toast"
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
    </>
  )
}
