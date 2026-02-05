// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLayoutStore, DEFAULT_LAYOUT, LAYOUT_PRESETS } from '../layoutStore'

// Mock window.electronAPI
const mockPreferencesGet = vi.fn()
const mockPreferencesSet = vi.fn()

Object.defineProperty(window, 'electronAPI', {
  value: {
    preferences: {
      get: mockPreferencesGet,
      set: mockPreferencesSet,
    },
  },
  writable: true,
})

describe('layoutStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useLayoutStore.setState({
      layout: { ...DEFAULT_LAYOUT, panels: DEFAULT_LAYOUT.panels.map(p => ({ ...p })) },
      activePresetId: null,
      isDirty: false,
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have default layout with 6 panels', () => {
      const { layout } = useLayoutStore.getState()
      expect(layout.panels).toHaveLength(6)
    })

    it('should have correct default panel zones', () => {
      const { layout } = useLayoutStore.getState()
      const fileTree = layout.panels.find(p => p.id === 'fileTree')
      const editor = layout.panels.find(p => p.id === 'editor')
      const viewer = layout.panels.find(p => p.id === 'viewer')
      const chat = layout.panels.find(p => p.id === 'chat')
      expect(fileTree?.zone).toBe('left')
      expect(editor?.zone).toBe('centerTop')
      expect(viewer?.zone).toBe('centerBottom')
      expect(chat?.zone).toBe('right')
    })

    it('should have default panel sizes', () => {
      const { layout } = useLayoutStore.getState()
      expect(layout.leftWidth).toBe(256)
      expect(layout.rightWidth).toBe(320)
      expect(layout.viewerHeight).toBe(256)
      expect(layout.consoleHeight).toBe(160)
    })

    it('should not be dirty initially', () => {
      const { isDirty } = useLayoutStore.getState()
      expect(isDirty).toBe(false)
    })

    it('should have no active preset initially', () => {
      const { activePresetId } = useLayoutStore.getState()
      expect(activePresetId).toBeNull()
    })
  })

  describe('getPanelsInZone', () => {
    it('should return panels in the specified zone', () => {
      const panels = useLayoutStore.getState().getPanelsInZone('left')
      expect(panels).toHaveLength(1)
      expect(panels[0].id).toBe('fileTree')
    })

    it('should return panels sorted by order', () => {
      const panels = useLayoutStore.getState().getPanelsInZone('right')
      expect(panels[0].id).toBe('chat')
      expect(panels[1].id).toBe('git')
      expect(panels[0].order).toBeLessThan(panels[1].order)
    })

    it('should exclude hidden panels', () => {
      useLayoutStore.getState().togglePanelVisibility('chat')
      const panels = useLayoutStore.getState().getPanelsInZone('right')
      expect(panels).toHaveLength(1)
      expect(panels[0].id).toBe('git')
    })
  })

  describe('togglePanelVisibility', () => {
    it('should toggle panel visibility', () => {
      expect(useLayoutStore.getState().isPanelVisible('chat')).toBe(true)
      useLayoutStore.getState().togglePanelVisibility('chat')
      expect(useLayoutStore.getState().isPanelVisible('chat')).toBe(false)
      useLayoutStore.getState().togglePanelVisibility('chat')
      expect(useLayoutStore.getState().isPanelVisible('chat')).toBe(true)
    })

    it('should mark layout as dirty', () => {
      useLayoutStore.getState().togglePanelVisibility('chat')
      expect(useLayoutStore.getState().isDirty).toBe(true)
    })

    it('should clear active preset when toggling visibility', () => {
      useLayoutStore.getState().applyPreset('code-focus')
      expect(useLayoutStore.getState().activePresetId).toBe('code-focus')
      useLayoutStore.getState().togglePanelVisibility('viewer')
      expect(useLayoutStore.getState().activePresetId).toBeNull()
    })
  })

  describe('presets', () => {
    it('should have 5 layout presets defined', () => {
      expect(LAYOUT_PRESETS).toHaveLength(5)
    })

    it('should apply default preset and restore all panels visible', () => {
      // Hide some panels first
      useLayoutStore.getState().togglePanelVisibility('viewer')
      useLayoutStore.getState().togglePanelVisibility('chat')

      useLayoutStore.getState().applyPreset('default')

      const state = useLayoutStore.getState()
      expect(state.activePresetId).toBe('default')
      expect(state.layout.panels.every(p => p.visible)).toBe(true)
    })

    it('should apply code-focus preset: hide viewer, chat, git', () => {
      useLayoutStore.getState().applyPreset('code-focus')

      const state = useLayoutStore.getState()
      expect(state.activePresetId).toBe('code-focus')
      expect(state.isPanelVisible('editor')).toBe(true)
      expect(state.isPanelVisible('viewer')).toBe(false)
      expect(state.isPanelVisible('chat')).toBe(false)
      expect(state.isPanelVisible('git')).toBe(false)
      expect(state.isPanelVisible('console')).toBe(true)
    })

    it('should apply viewer-focus preset: hide editor, console', () => {
      useLayoutStore.getState().applyPreset('viewer-focus')

      const state = useLayoutStore.getState()
      expect(state.isPanelVisible('viewer')).toBe(true)
      expect(state.isPanelVisible('editor')).toBe(false)
      expect(state.isPanelVisible('console')).toBe(false)
    })

    it('should apply presentation preset: only viewer visible', () => {
      useLayoutStore.getState().applyPreset('presentation')

      const state = useLayoutStore.getState()
      const visiblePanels = state.layout.panels.filter(p => p.visible)
      expect(visiblePanels).toHaveLength(1)
      expect(visiblePanels[0].id).toBe('viewer')
    })

    it('should apply side-by-side preset: hide chat, git, fileTree', () => {
      useLayoutStore.getState().applyPreset('side-by-side')

      const state = useLayoutStore.getState()
      expect(state.isPanelVisible('editor')).toBe(true)
      expect(state.isPanelVisible('viewer')).toBe(true)
      expect(state.isPanelVisible('chat')).toBe(false)
      expect(state.isPanelVisible('git')).toBe(false)
      expect(state.isPanelVisible('fileTree')).toBe(false)
    })

    it('should ignore unknown preset id', () => {
      const before = useLayoutStore.getState().layout
      useLayoutStore.getState().applyPreset('nonexistent')
      const after = useLayoutStore.getState().layout
      expect(after).toEqual(before)
    })

    it('should mark layout as dirty after applying preset', () => {
      useLayoutStore.getState().applyPreset('code-focus')
      expect(useLayoutStore.getState().isDirty).toBe(true)
    })
  })

  describe('resetLayout (Feature #69)', () => {
    it('should restore default layout', () => {
      // Modify layout via preset
      useLayoutStore.getState().applyPreset('presentation')
      expect(useLayoutStore.getState().layout.panels.filter(p => p.visible)).toHaveLength(1)

      // Reset
      useLayoutStore.getState().resetLayout()

      const { layout } = useLayoutStore.getState()
      expect(layout.panels.every(p => p.visible)).toBe(true)
      const fileTree = layout.panels.find(p => p.id === 'fileTree')
      expect(fileTree?.zone).toBe('left')
    })

    it('should restore default sizes', () => {
      useLayoutStore.getState().setLayout({
        ...DEFAULT_LAYOUT,
        leftWidth: 400,
        rightWidth: 500,
      })

      useLayoutStore.getState().resetLayout()

      const { layout } = useLayoutStore.getState()
      expect(layout.leftWidth).toBe(256)
      expect(layout.rightWidth).toBe(320)
      expect(layout.viewerHeight).toBe(256)
      expect(layout.consoleHeight).toBe(160)
    })

    it('should mark layout as dirty after reset', () => {
      useLayoutStore.getState().resetLayout()
      expect(useLayoutStore.getState().isDirty).toBe(true)
    })

    it('should clear active preset after reset', () => {
      useLayoutStore.getState().applyPreset('code-focus')
      useLayoutStore.getState().resetLayout()
      expect(useLayoutStore.getState().activePresetId).toBeNull()
    })
  })

  describe('persistence (Feature #68)', () => {
    it('should set layout from loaded data', () => {
      const customLayout = {
        ...DEFAULT_LAYOUT,
        leftWidth: 300,
        panels: DEFAULT_LAYOUT.panels.map(p =>
          p.id === 'fileTree' ? { ...p, zone: 'right' as const } : p
        ),
      }
      useLayoutStore.getState().setLayout(customLayout)

      const { layout, isDirty } = useLayoutStore.getState()
      expect(layout.leftWidth).toBe(300)
      expect(layout.panels.find(p => p.id === 'fileTree')?.zone).toBe('right')
      expect(isDirty).toBe(false) // setLayout marks clean
    })

    it('should save layout to Electron preferences', async () => {
      mockPreferencesSet.mockResolvedValue(true)
      await useLayoutStore.getState().saveToElectron()
      expect(mockPreferencesSet).toHaveBeenCalledWith('layout', expect.objectContaining({
        panels: expect.any(Array),
        leftWidth: 256,
      }))
    })

    it('should load layout from Electron preferences', async () => {
      const savedLayout = {
        ...DEFAULT_LAYOUT,
        leftWidth: 400,
        panels: DEFAULT_LAYOUT.panels.map(p => ({ ...p })),
      }
      mockPreferencesGet.mockResolvedValue(savedLayout)
      await useLayoutStore.getState().loadFromElectron()

      const { layout } = useLayoutStore.getState()
      expect(layout.leftWidth).toBe(400)
    })

    it('should keep defaults when no saved layout exists', async () => {
      mockPreferencesGet.mockResolvedValue(null)
      await useLayoutStore.getState().loadFromElectron()

      const { layout } = useLayoutStore.getState()
      expect(layout.leftWidth).toBe(256)
    })

    it('should keep defaults when saved layout is invalid', async () => {
      mockPreferencesGet.mockResolvedValue({ panels: [] })
      await useLayoutStore.getState().loadFromElectron()

      const { layout } = useLayoutStore.getState()
      expect(layout.panels).toHaveLength(6)
    })

    it('should mark clean after save', async () => {
      mockPreferencesSet.mockResolvedValue(true)
      useLayoutStore.getState().applyPreset('code-focus')
      expect(useLayoutStore.getState().isDirty).toBe(true)

      await useLayoutStore.getState().saveToElectron()
      expect(useLayoutStore.getState().isDirty).toBe(false)
    })

    it('markClean should clear dirty flag', () => {
      useLayoutStore.getState().applyPreset('code-focus')
      expect(useLayoutStore.getState().isDirty).toBe(true)
      useLayoutStore.getState().markClean()
      expect(useLayoutStore.getState().isDirty).toBe(false)
    })
  })
})
