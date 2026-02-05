// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLayoutStore, LAYOUT_PRESETS } from '../stores/layoutStore'
import type { ElectronAPI } from '../../shared/types'

/**
 * Integration tests for layout features:
 * - Panel visibility toggles
 * - Layout presets
 * - Panel layout save/restore on restart
 * - Reset layout button restores default panel arrangement
 */

describe('Layout Features Integration', () => {
  beforeEach(() => {
    // Reset to default layout before each test
    useLayoutStore.setState({
      layout: {
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
      },
      activePresetId: null,
      isDirty: false,
    })
  })

  describe('Panel visibility toggles', () => {
    it('should toggle panel visibility', () => {
      expect(useLayoutStore.getState().isPanelVisible('editor')).toBe(true)
      useLayoutStore.getState().togglePanelVisibility('editor')
      expect(useLayoutStore.getState().isPanelVisible('editor')).toBe(false)
    })

    it('should get panels in a specific zone sorted by order', () => {
      const store = useLayoutStore.getState()
      const rightPanels = store.getPanelsInZone('right')

      expect(rightPanels.length).toBeGreaterThan(0)
      expect(rightPanels[0].zone).toBe('right')

      // Verify panels are sorted by order
      for (let i = 1; i < rightPanels.length; i++) {
        expect(rightPanels[i].order).toBeGreaterThanOrEqual(rightPanels[i - 1].order)
      }
    })

    it('should exclude hidden panels from zone query', () => {
      useLayoutStore.getState().togglePanelVisibility('chat')
      const rightPanels = useLayoutStore.getState().getPanelsInZone('right')
      expect(rightPanels).toHaveLength(1)
      expect(rightPanels[0].id).toBe('git')
    })
  })

  describe('Layout Presets', () => {
    it('should apply code-focus preset', () => {
      useLayoutStore.getState().applyPreset('code-focus')

      const state = useLayoutStore.getState()
      expect(state.activePresetId).toBe('code-focus')
      expect(state.isPanelVisible('editor')).toBe(true)
      expect(state.isPanelVisible('viewer')).toBe(false)
      expect(state.isPanelVisible('chat')).toBe(false)
    })

    it('should apply presentation preset: only viewer visible', () => {
      useLayoutStore.getState().applyPreset('presentation')

      const state = useLayoutStore.getState()
      const visible = state.layout.panels.filter(p => p.visible)
      expect(visible).toHaveLength(1)
      expect(visible[0].id).toBe('viewer')
    })

    it('should switch between presets', () => {
      useLayoutStore.getState().applyPreset('code-focus')
      expect(useLayoutStore.getState().isPanelVisible('viewer')).toBe(false)

      useLayoutStore.getState().applyPreset('default')
      expect(useLayoutStore.getState().isPanelVisible('viewer')).toBe(true)
      expect(useLayoutStore.getState().layout.panels.every(p => p.visible)).toBe(true)
    })

    it('should have all expected presets', () => {
      const presetIds = LAYOUT_PRESETS.map(p => p.id)
      expect(presetIds).toContain('default')
      expect(presetIds).toContain('code-focus')
      expect(presetIds).toContain('viewer-focus')
      expect(presetIds).toContain('side-by-side')
      expect(presetIds).toContain('presentation')
    })
  })

  describe('Feature #68: Panel layout is saved and restored on restart', () => {
    it('should save layout to Electron preferences', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined)
      window.electronAPI = {
        preferences: {
          set: mockSet,
          get: vi.fn(),
        },
      } as unknown as ElectronAPI

      useLayoutStore.getState().applyPreset('code-focus')
      await useLayoutStore.getState().saveToElectron()

      expect(mockSet).toHaveBeenCalledWith('layout', expect.objectContaining({
        panels: expect.any(Array),
      }))
      expect(useLayoutStore.getState().isDirty).toBe(false)
    })

    it('should load layout from Electron preferences', async () => {
      const customLayout = {
        panels: [
          { id: 'editor', zone: 'left', order: 0, visible: true },
          { id: 'viewer', zone: 'centerTop', order: 0, visible: true },
          { id: 'fileTree', zone: 'centerBottom', order: 0, visible: true },
          { id: 'console', zone: 'centerBottom', order: 1, visible: true },
          { id: 'chat', zone: 'right', order: 0, visible: true },
          { id: 'git', zone: 'right', order: 1, visible: true },
        ],
        leftWidth: 400,
        rightWidth: 280,
        viewerHeight: 350,
        consoleHeight: 160,
      }

      window.electronAPI = {
        preferences: {
          get: vi.fn().mockResolvedValue(customLayout),
          set: vi.fn(),
        },
      } as unknown as ElectronAPI

      await useLayoutStore.getState().loadFromElectron()

      const store = useLayoutStore.getState()
      expect(store.layout.panels).toEqual(customLayout.panels)
      expect(store.layout.leftWidth).toBe(400)
      expect(store.layout.rightWidth).toBe(280)
      expect(store.layout.viewerHeight).toBe(350)
      expect(store.isDirty).toBe(false)
    })

    it('should preserve panel sizes in layout config', () => {
      const currentLayout = useLayoutStore.getState().layout
      const customLayout = {
        ...currentLayout,
        leftWidth: 400,
        rightWidth: 280,
        viewerHeight: 350,
      }

      useLayoutStore.getState().setLayout(customLayout)

      const store = useLayoutStore.getState()
      expect(store.layout.leftWidth).toBe(400)
      expect(store.layout.rightWidth).toBe(280)
      expect(store.layout.viewerHeight).toBe(350)
    })

    it('should handle missing Electron API gracefully', async () => {
      const originalAPI = window.electronAPI
      delete (window as { electronAPI?: ElectronAPI }).electronAPI

      await useLayoutStore.getState().saveToElectron()
      await useLayoutStore.getState().loadFromElectron()

      expect(useLayoutStore.getState().layout).toBeDefined()

      ;(window as { electronAPI?: ElectronAPI }).electronAPI = originalAPI
    })
  })

  describe('Feature #69: Reset layout button restores default panel arrangement', () => {
    it('should reset all panels to default positions', () => {
      useLayoutStore.getState().applyPreset('presentation')
      useLayoutStore.getState().resetLayout()

      const store = useLayoutStore.getState()
      const editor = store.layout.panels.find(p => p.id === 'editor')
      const viewer = store.layout.panels.find(p => p.id === 'viewer')
      const fileTree = store.layout.panels.find(p => p.id === 'fileTree')
      const chat = store.layout.panels.find(p => p.id === 'chat')

      expect(editor?.zone).toBe('centerTop')
      expect(viewer?.zone).toBe('centerBottom')
      expect(fileTree?.zone).toBe('left')
      expect(chat?.zone).toBe('right')
    })

    it('should reset panel sizes to defaults', () => {
      const currentLayout = useLayoutStore.getState().layout

      useLayoutStore.getState().setLayout({
        ...currentLayout,
        leftWidth: 400,
        rightWidth: 500,
        viewerHeight: 400,
      })

      useLayoutStore.getState().resetLayout()

      const store = useLayoutStore.getState()
      expect(store.layout.leftWidth).toBe(256)
      expect(store.layout.rightWidth).toBe(320)
      expect(store.layout.viewerHeight).toBe(256)
    })

    it('should mark layout as dirty after reset', () => {
      useLayoutStore.getState().markClean()
      expect(useLayoutStore.getState().isDirty).toBe(false)

      useLayoutStore.getState().resetLayout()

      expect(useLayoutStore.getState().isDirty).toBe(true)
    })

    it('should restore all default panel visibility', () => {
      useLayoutStore.getState().applyPreset('presentation')
      useLayoutStore.getState().resetLayout()

      const store = useLayoutStore.getState()
      const allPanels = store.layout.panels
      expect(allPanels.every(p => p.visible)).toBe(true)
    })
  })

  describe('Preset + Persistence Combined', () => {
    it('should allow complete workflow: apply preset, save, reset, load', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined)
      const mockGet = vi.fn()
      window.electronAPI = {
        preferences: {
          set: mockSet,
          get: mockGet,
        },
      } as unknown as ElectronAPI

      // 1. Apply preset
      useLayoutStore.getState().applyPreset('code-focus')
      expect(useLayoutStore.getState().isPanelVisible('viewer')).toBe(false)

      // 2. Save layout
      await useLayoutStore.getState().saveToElectron()
      expect(mockSet).toHaveBeenCalled()
      const savedLayout = mockSet.mock.calls[0][1]

      // 3. Reset layout
      useLayoutStore.getState().resetLayout()
      expect(useLayoutStore.getState().isPanelVisible('viewer')).toBe(true)

      // 4. Load saved layout
      mockGet.mockResolvedValue(savedLayout)
      await useLayoutStore.getState().loadFromElectron()
      expect(useLayoutStore.getState().isPanelVisible('viewer')).toBe(false)
    })
  })
})
