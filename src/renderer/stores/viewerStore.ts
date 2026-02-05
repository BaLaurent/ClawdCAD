import { create } from 'zustand'
import type { BufferGeometry } from 'three'

interface ViewerState {
  geometry: BufferGeometry | null
  isLoading: boolean
  modelBounds: { min: [number, number, number]; max: [number, number, number] } | null
  wireframe: boolean
  meshColor: string
  useOriginalColors: boolean
  hasVertexColors: boolean

  setGeometry: (geo: BufferGeometry | null) => void
  setLoading: (loading: boolean) => void
  setWireframe: (wireframe: boolean) => void
  setMeshColor: (color: string) => void
  setUseOriginalColors: (use: boolean) => void
  setHasVertexColors: (has: boolean) => void
  clear: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  geometry: null,
  isLoading: false,
  modelBounds: null,
  wireframe: false,
  meshColor: '#8899aa',
  useOriginalColors: true,
  hasVertexColors: false,

  setGeometry: (geo) => {
    let modelBounds = null
    if (geo && geo.boundingBox) {
      const bb = geo.boundingBox
      modelBounds = {
        min: [bb.min.x, bb.min.y, bb.min.z] as [number, number, number],
        max: [bb.max.x, bb.max.y, bb.max.z] as [number, number, number],
      }
    }
    set({ geometry: geo, isLoading: false, modelBounds })
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setWireframe: (wireframe) => set({ wireframe }),
  setMeshColor: (color) => set({ meshColor: color }),
  setUseOriginalColors: (use) => set({ useOriginalColors: use }),
  setHasVertexColors: (has) => set({ hasVertexColors: has }),

  clear: () => set({ geometry: null, isLoading: false, modelBounds: null, hasVertexColors: false }),
}))
