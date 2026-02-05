import { Component, useRef, useEffect, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { useSettingsStore } from '../stores/settingsStore'
import { useViewerStore } from '../stores/viewerStore'
import { useCompilerStore } from '../stores/compilerStore'
import { useWebGLReady } from '../hooks/useWebGLReady'
import ViewerToolbar from './ViewerToolbar'
import { isAsciiSTL, parseSTLAscii, parseSTLBinary, parseOFF } from '../utils/geometryParsers'

/** Error boundary for WebGL/Canvas failures.
 *  Calls onError callback instead of reloading the page. */
interface ErrorBoundaryProps { children: ReactNode; fallback: ReactNode; onError?: () => void }
interface ErrorBoundaryState { hasError: boolean }

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[Viewer3D] WebGL context creation failed:', error.message)
    this.props.onError?.()
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

/** Inner scene component that has access to Three.js context */
function SceneContent() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const viewerPrefs = useSettingsStore((s) => s.preferences.viewer)
  const { geometry, isLoading, wireframe, meshColor, useOriginalColors, hasVertexColors } = useViewerStore()

  const defaultCameraPos = useMemo(() => new THREE.Vector3(50, 50, 50), [])

  // Auto-fit camera when geometry changes
  useEffect(() => {
    if (!geometry || !geometry.boundingSphere) return
    const sphere = geometry.boundingSphere
    const radius = sphere.radius || 50
    const distance = radius * 2.5
    const cam = camera as THREE.PerspectiveCamera
    cam.position.set(distance, distance * 0.8, distance)
    cam.lookAt(0, 0, 0)
    cam.near = 0.1
    cam.far = Math.max(1000, distance * 10)
    cam.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [geometry, camera])

  // Double-click to reset camera
  const handleDoubleClick = useCallback(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.position.copy(defaultCameraPos)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [camera, defaultCameraPos])

  useEffect(() => {
    const canvas = document.querySelector('[data-testid="viewer-canvas"] canvas')
    if (canvas) {
      canvas.addEventListener('dblclick', handleDoubleClick)
      return () => canvas.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [handleDoubleClick])

    /* eslint-disable react/no-unknown-property */
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} />

      {/* Grid */}
      {viewerPrefs.showGrid && (
        <gridHelper args={[100, 20, '#555555', '#333333']} />
      )}

      {/* Axes */}
      {viewerPrefs.showAxes && (
        <axesHelper args={[50]} />
      )}

      {/* Model Mesh */}
      {geometry && (
        <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            key={`mat-${useOriginalColors && hasVertexColors}`}
            color={useOriginalColors && hasVertexColors ? '#ffffff' : meshColor}
            vertexColors={useOriginalColors && hasVertexColors}
            roughness={0.5}
            metalness={0.1}
            side={THREE.DoubleSide}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <mesh>
          <boxGeometry args={[5, 5, 5]} />
          <meshStandardMaterial color="#ffaa00" wireframe />
        </mesh>
      )}

      {/* OrbitControls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.8}
        panSpeed={0.8}
        zoomSpeed={1.0}
      />

      {/* Orientation gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.8} />
      </GizmoHelper>
    </>
  )
}

/** Fallback UI when WebGL is unavailable */
function ViewerFallback({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const lastStl = useCompilerStore((s) => s.lastStl)
  const viewerPrefs = useSettingsStore((s) => s.preferences.viewer)

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-gray-400"
      style={{ background: viewerPrefs.backgroundColor }}
      data-testid="viewer-fallback"
    >
      <div className="text-4xl mb-2">🎲</div>
      <div className="text-sm font-medium">3D Viewer</div>
      <div className="text-xs text-gray-500 mt-1">
        {message ?? (lastStl ? `STL loaded (${(lastStl.byteLength / 1024).toFixed(1)} KB)` : 'WebGL unavailable in this environment')}
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {viewerPrefs.showGrid ? '☑ Grid' : '☐ Grid'}{' '}
        {viewerPrefs.showAxes ? '☑ Axes' : '☐ Axes'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}

const MAX_CANVAS_RETRIES = 3
// Delays between Canvas remount retries: 1.5s, 3s, 6s
const RETRY_BASE_DELAY_MS = 1500

export default function Viewer3D() {
  const viewerPrefs = useSettingsStore((s) => s.preferences.viewer)
  const lastStl = useCompilerStore((s) => s.lastStl)
  const isCompiling = useCompilerStore((s) => s.isCompiling)
  const { setGeometry, setLoading } = useViewerStore()

  const { isReady, reset: resetGpuGate } = useWebGLReady()
  const [canvasKey, setCanvasKey] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [permanentFailure, setPermanentFailure] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  // Store context event handlers in a ref for cleanup
  const contextHandlersRef = useRef<{
    canvas: HTMLCanvasElement | null
    onLost: ((e: Event) => void) | null
    onRestored: (() => void) | null
  }>({ canvas: null, onLost: null, onRestored: null })

  // Cleanup context event listeners when canvasKey changes (Canvas remount)
  useEffect(() => {
    return () => {
      const { canvas, onLost, onRestored } = contextHandlersRef.current
      if (canvas) {
        if (onLost) canvas.removeEventListener('webglcontextlost', onLost)
        if (onRestored) canvas.removeEventListener('webglcontextrestored', onRestored)
      }
      contextHandlersRef.current = { canvas: null, onLost: null, onRestored: null }
    }
  }, [canvasKey])

  // Handle error boundary callback — retry with generous exponential backoff
  const handleCanvasError = useCallback(() => {
    if (retryCount >= MAX_CANVAS_RETRIES) {
      console.error(`[Viewer3D] Canvas failed after ${MAX_CANVAS_RETRIES} retries, giving up`)
      setPermanentFailure(true)
      setIsRecovering(false)
      return
    }
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount)
    console.log(`[Viewer3D] Canvas error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_CANVAS_RETRIES})`)
    setIsRecovering(true)
    setTimeout(() => {
      setRetryCount((c) => c + 1)
      setCanvasKey((k) => k + 1)
      setIsRecovering(false)
    }, delay)
  }, [retryCount])

  // Manual retry: reset everything and re-trigger the GPU gate delay
  const handleManualRetry = useCallback(() => {
    setPermanentFailure(false)
    setRetryCount(0)
    setCanvasKey((k) => k + 1)
    setIsRecovering(false)
    resetGpuGate()
  }, [resetGpuGate])

  const lastOff = useCompilerStore((s) => s.lastOff)
  const { setHasVertexColors } = useViewerStore()

  // React to compile result changes — prefer OFF (has colors), fall back to STL
  useEffect(() => {
    if (!lastStl && !lastOff) return
    setLoading(true)
    try {
      // Try OFF first (has per-face colors)
      if (lastOff) {
        try {
          const geo = parseOFF(lastOff)
          const hasColors = geo.hasAttribute('color')
          setHasVertexColors(hasColors)
          setGeometry(geo)
          return
        } catch (offErr) {
          console.warn('[Viewer3D] OFF parse failed, falling back to STL:', offErr)
        }
      }

      // Fall back to STL
      setHasVertexColors(false)
      if (lastStl) {
        const isAscii = isAsciiSTL(lastStl)
        const geo = isAscii ? parseSTLAscii(lastStl) : parseSTLBinary(lastStl)
        setGeometry(geo)
      } else {
        setGeometry(null)
      }
    } catch (err) {
      console.error('[Viewer3D] Geometry parse FAILED:', err)
      setHasVertexColors(false)
      setGeometry(null)
    } finally {
      setLoading(false)
    }
  }, [lastStl, lastOff, setGeometry, setLoading, setHasVertexColors])

  const compilingOverlay = isCompiling && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent" />
        <span className="text-xs text-cyan-400 font-medium">Compiling...</span>
      </div>
    </div>
  )

  // GPU gate delay still running
  if (!isReady) {
    return (
      <div className="w-full h-full relative" data-testid="viewer-canvas">
        <ViewerFallback message="Initializing GPU..." />
        {compilingOverlay}
        <ViewerToolbar />
      </div>
    )
  }

  // Canvas retries exhausted
  if (permanentFailure) {
    return (
      <div className="w-full h-full relative" data-testid="viewer-canvas">
        <ViewerFallback
          message="WebGL context creation failed"
          onRetry={handleManualRetry}
        />
        {compilingOverlay}
        <ViewerToolbar />
      </div>
    )
  }

  return (
    <div className="w-full h-full relative" data-testid="viewer-canvas">
      {compilingOverlay}
      <WebGLErrorBoundary
        fallback={<ViewerFallback message="WebGL error" onRetry={handleManualRetry} />}
        onError={handleCanvasError}
      >
        <Canvas
          key={canvasKey}
          camera={{ fov: 50, near: 0.1, far: 1000, position: [50, 50, 50] }}
          style={{ background: viewerPrefs.backgroundColor }}
          gl={{
            antialias: true,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false,
            powerPreference: 'default',
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement

            const handleContextLost = (event: Event) => {
              event.preventDefault()
              setIsRecovering(true)
            }

            const handleContextRestored = () => {
              setCanvasKey((prev) => prev + 1)
              setTimeout(() => setIsRecovering(false), 100)
            }

            // Clean up previous handlers if any
            const prev = contextHandlersRef.current
            if (prev.canvas) {
              if (prev.onLost) prev.canvas.removeEventListener('webglcontextlost', prev.onLost)
              if (prev.onRestored) prev.canvas.removeEventListener('webglcontextrestored', prev.onRestored)
            }

            canvas.addEventListener('webglcontextlost', handleContextLost)
            canvas.addEventListener('webglcontextrestored', handleContextRestored)

            contextHandlersRef.current = { canvas, onLost: handleContextLost, onRestored: handleContextRestored }
          }}
        >
          <SceneContent />
        </Canvas>
      </WebGLErrorBoundary>
      <ViewerToolbar />
      {isRecovering && (
        <div
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
          data-testid="recovery-indicator"
        >
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Restoring 3D view...</span>
        </div>
      )}
    </div>
  )
}
