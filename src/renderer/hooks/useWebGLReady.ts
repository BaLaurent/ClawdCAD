import { useState, useEffect, useCallback } from 'react'

/**
 * Provides a minimum startup delay before attempting Canvas mount,
 * plus a reset function to re-trigger the delay (for retry without page reload).
 *
 * Why not an offscreen canvas probe? A 1x1 canvas gets a WebGL context even when
 * Electron's GPU process isn't warmed up for real R3F rendering with shaders.
 * The probe gives false positives. A flat delay is more honest and reliable.
 */
const INITIAL_DELAY_MS = 600

export function useWebGLReady(): { isReady: boolean; reset: () => void } {
  const [isReady, setIsReady] = useState(false)
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    setIsReady(false)
    const timer = setTimeout(() => setIsReady(true), INITIAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [epoch])

  const reset = useCallback(() => {
    setEpoch((e) => e + 1)
  }, [])

  return { isReady, reset }
}
