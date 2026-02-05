import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../../stores/settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      preferences: {
        editor: { theme: 'dark', fontSize: 14, tabSize: 4, autoCompile: true, autoCompileDelay: 1500 },
        compiler: { timeout: 30000 },
        agent: { maxIterations: 5, maxTokens: 50000 },
        chat: { maxTokens: 10000 },
        viewer: { backgroundColor: '#1a1a2e', showGrid: true, showAxes: true },
        git: { authorName: 'ClawdCAD User', authorEmail: 'user@ClawdCAD.local' },
        language: 'fr',
        recentProjects: [],
      },
      isLoaded: false,
    })
  })

  describe('addRecentProject', () => {
    it('should add a project to the recent list', () => {
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(1)
      expect(projects[0].path).toBe('/projects/alpha')
      expect(projects[0].name).toBe('Alpha')
      expect(projects[0].lastOpened).toBeGreaterThan(0)
    })

    it('should move existing project to the front when re-added', () => {
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      useSettingsStore.getState().addRecentProject('/projects/beta', 'Beta')
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(2)
      expect(projects[0].path).toBe('/projects/alpha')
      expect(projects[1].path).toBe('/projects/beta')
    })

    it('should limit recent projects to 10', () => {
      for (let i = 0; i < 15; i++) {
        useSettingsStore.getState().addRecentProject(`/projects/p${i}`, `P${i}`)
      }
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(10)
    })
  })

  describe('removeRecentProject', () => {
    it('should remove a project by path', () => {
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      useSettingsStore.getState().addRecentProject('/projects/beta', 'Beta')
      useSettingsStore.getState().removeRecentProject('/projects/alpha')
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(1)
      expect(projects[0].path).toBe('/projects/beta')
    })

    it('should not affect other projects when removing one', () => {
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      useSettingsStore.getState().addRecentProject('/projects/beta', 'Beta')
      useSettingsStore.getState().addRecentProject('/projects/gamma', 'Gamma')
      useSettingsStore.getState().removeRecentProject('/projects/beta')
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(2)
      expect(projects.find(p => p.path === '/projects/alpha')).toBeTruthy()
      expect(projects.find(p => p.path === '/projects/gamma')).toBeTruthy()
      expect(projects.find(p => p.path === '/projects/beta')).toBeUndefined()
    })

    it('should handle removing a non-existent project gracefully', () => {
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      useSettingsStore.getState().removeRecentProject('/projects/nonexistent')
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(1)
      expect(projects[0].path).toBe('/projects/alpha')
    })

    it('should result in empty list when removing the only project', () => {
      useSettingsStore.getState().addRecentProject('/projects/alpha', 'Alpha')
      useSettingsStore.getState().removeRecentProject('/projects/alpha')
      const projects = useSettingsStore.getState().preferences.recentProjects
      expect(projects).toHaveLength(0)
    })
  })
})
