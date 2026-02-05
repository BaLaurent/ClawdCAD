import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockStore is available when vi.mock is hoisted
const { mockStore } = vi.hoisted(() => {
  const mockStore = {
    get: vi.fn(),
    set: vi.fn(),
    store: {} as Record<string, unknown>,
    clear: vi.fn(),
    path: '/tmp/config.json',
  }
  return { mockStore }
})

vi.mock('electron-store', () => {
  return {
    default: function ElectronStore() {
      return mockStore
    },
  }
})

import { preferencesService } from '../PreferencesService'

describe('PreferencesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.store = {
      editor: { theme: 'dark', fontSize: 14, tabSize: 4, autoCompile: true, autoCompileDelay: 1500 },
      compiler: { timeout: 30000 },
      agent: { maxIterations: 5, maxTokens: 50000, mode: 'api_key' },
      viewer: { backgroundColor: '#1a1a2e', showGrid: true, showAxes: true },
      git: { authorName: 'ClawdCAD User', authorEmail: 'user@ClawdCAD.local' },
      language: 'fr',
      recentProjects: [],
    }
  })

  describe('get', () => {
    it('should delegate to store.get', () => {
      mockStore.get.mockReturnValue({ theme: 'dark', fontSize: 14, tabSize: 4, autoCompile: true, autoCompileDelay: 1500 })
      const result = preferencesService.get('editor')
      expect(mockStore.get).toHaveBeenCalledWith('editor')
      expect(result.theme).toBe('dark')
    })
  })

  describe('set', () => {
    it('should delegate to store.set', () => {
      preferencesService.set('language', 'en')
      expect(mockStore.set).toHaveBeenCalledWith('language', 'en')
    })
  })

  describe('getAll', () => {
    it('should return full store contents', () => {
      const all = preferencesService.getAll()
      expect(all).toBe(mockStore.store)
    })
  })

  describe('reset', () => {
    it('should clear the store', () => {
      preferencesService.reset()
      expect(mockStore.clear).toHaveBeenCalled()
    })
  })

  describe('getPath', () => {
    it('should return store path', () => {
      expect(preferencesService.getPath()).toBe('/tmp/config.json')
    })
  })
})
