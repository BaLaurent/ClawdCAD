import { create } from 'zustand'
import type { PanelId, LayoutZone, PanelConfig, LayoutConfig } from '@shared/types'

export const DEFAULT_LAYOUT: LayoutConfig = {
  panels: [
    { id: 'fileTree', zone: 'left', order: 0, visible: true },
    { id: 'editor', zone: 'centerTop', order: 0, visible: true },
    { id: 'viewer', zone: 'centerBottom', order: 0, visible: true },
    { id: 'console', zone: 'centerBottom', order: 1, visible: true },
    { id: 'chat', zone: 'right', order: 0, visible: true },
    { id: 'git', zone: 'right', order: 1, visible: true },
  ],
  leftWidth: 256,
  rightWidth: 320,
  viewerHeight: 256,
  consoleHeight: 160,
}

export interface LayoutPreset {
  id: string
  name: string
  icon: string
  description: string
  apply: (current: LayoutConfig) => LayoutConfig
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'default',
    name: 'Default',
    icon: '⊞',
    description: 'Editor + Viewer + Chat sidebar',
    apply: () => ({
      ...DEFAULT_LAYOUT,
      panels: DEFAULT_LAYOUT.panels.map(p => ({ ...p })),
    }),
  },
  {
    id: 'code-focus',
    name: 'Code Focus',
    icon: '⌨',
    description: 'Large editor, hidden viewer',
    apply: (current) => ({
      ...current,
      panels: current.panels.map(p => ({
        ...p,
        visible: p.id === 'viewer' ? false : p.id === 'chat' ? false : p.id === 'git' ? false : true,
      })),
    }),
  },
  {
    id: 'viewer-focus',
    name: 'Viewer Focus',
    icon: '🔭',
    description: 'Large viewer, minimal editor',
    apply: (current) => ({
      ...current,
      panels: current.panels.map(p => ({
        ...p,
        visible: p.id === 'editor' ? false : p.id === 'console' ? false : true,
      })),
    }),
  },
  {
    id: 'side-by-side',
    name: 'Side by Side',
    icon: '⬚',
    description: 'Editor and viewer, no sidebar',
    apply: (current) => ({
      ...current,
      panels: current.panels.map(p => ({
        ...p,
        visible: p.id === 'chat' ? false : p.id === 'git' ? false : p.id === 'fileTree' ? false : true,
      })),
    }),
  },
  {
    id: 'presentation',
    name: 'Presentation',
    icon: '🖥',
    description: 'Viewer fullscreen, all else hidden',
    apply: (current) => ({
      ...current,
      panels: current.panels.map(p => ({
        ...p,
        visible: p.id === 'viewer',
      })),
    }),
  },
]

interface LayoutState {
  layout: LayoutConfig
  activePresetId: string | null
  isDirty: boolean

  // Panel queries
  getPanelsInZone: (zone: LayoutZone) => PanelConfig[]

  // Panel visibility
  togglePanelVisibility: (panelId: PanelId) => void
  isPanelVisible: (panelId: PanelId) => boolean

  // Presets
  applyPreset: (presetId: string) => void

  // Persistence
  setLayout: (layout: LayoutConfig) => void
  resetLayout: () => void
  markClean: () => void

  // Save/load via Electron preferences
  saveToElectron: () => Promise<void>
  loadFromElectron: () => Promise<void>
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layout: { ...DEFAULT_LAYOUT, panels: DEFAULT_LAYOUT.panels.map(p => ({ ...p })) },
  activePresetId: null,
  isDirty: false,

  getPanelsInZone: (zone) => {
    return get().layout.panels
      .filter(p => p.zone === zone && p.visible)
      .sort((a, b) => a.order - b.order)
  },

  togglePanelVisibility: (panelId) => {
    set((state) => {
      const panels = state.layout.panels.map(p => {
        if (p.id === panelId) {
          return { ...p, visible: !p.visible }
        }
        return p
      })
      return { layout: { ...state.layout, panels }, isDirty: true, activePresetId: null }
    })
    // Save to Electron after toggle
    setTimeout(() => get().saveToElectron(), 0)
  },

  isPanelVisible: (panelId) => {
    const panel = get().layout.panels.find(p => p.id === panelId)
    return panel?.visible ?? false
  },

  applyPreset: (presetId) => {
    const preset = LAYOUT_PRESETS.find(p => p.id === presetId)
    if (!preset) return

    const newLayout = preset.apply(get().layout)
    set({ layout: newLayout, activePresetId: presetId, isDirty: true })
    get().saveToElectron()
  },

  setLayout: (layout) => {
    set({ layout: { ...layout, panels: layout.panels.map(p => ({ ...p })) }, isDirty: false })
  },

  resetLayout: () => {
    set({
      layout: { ...DEFAULT_LAYOUT, panels: DEFAULT_LAYOUT.panels.map(p => ({ ...p })) },
      activePresetId: null,
      isDirty: true,
    })
  },

  markClean: () => set({ isDirty: false }),

  saveToElectron: async () => {
    if (!window.electronAPI) return
    const { layout } = get()
    try {
      await window.electronAPI.preferences.set('layout', layout)
      set({ isDirty: false })
    } catch {
      // Silently fail if Electron not available
    }
  },

  loadFromElectron: async () => {
    if (!window.electronAPI) return
    try {
      const savedLayout = await window.electronAPI.preferences.get('layout')
      if (savedLayout && savedLayout.panels && savedLayout.panels.length > 0) {
        set({ layout: savedLayout, isDirty: false })
      }
    } catch {
      // Keep defaults if not available
    }
  },
}))
