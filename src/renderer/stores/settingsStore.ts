import { create } from 'zustand'
import type { Preferences } from '@shared/types'

const defaultSettings: Preferences = {
  editor: {
    theme: 'dark',
    fontSize: 14,
    tabSize: 4,
    autoCompile: true,
    autoCompileDelay: 1500,
  },
  compiler: {
    timeout: 30000,
  },
  agent: {
    maxIterations: 5,
    maxTokens: 50000,
  },
  chat: {
    maxTokens: 4096,
  },
  viewer: {
    backgroundColor: '#1a1a2e',
    showGrid: true,
    showAxes: true,
  },
  git: {
    authorName: 'ClawdCAD User',
    authorEmail: 'user@ClawdCAD.local',
  },
  language: 'fr',
  recentProjects: [],
}

interface SettingsState {
  preferences: Preferences
  isLoaded: boolean

  setPreferences: (prefs: Preferences) => void
  updateEditorSetting: <K extends keyof Preferences['editor']>(key: K, value: Preferences['editor'][K]) => void
  updateViewerSetting: <K extends keyof Preferences['viewer']>(key: K, value: Preferences['viewer'][K]) => void
  updateAgentSetting: <K extends keyof Preferences['agent']>(key: K, value: Preferences['agent'][K]) => void
  updateChatSetting: <K extends keyof Preferences['chat']>(key: K, value: Preferences['chat'][K]) => void
  updateGitSetting: <K extends keyof Preferences['git']>(key: K, value: Preferences['git'][K]) => void
  addRecentProject: (path: string, name: string) => void
  removeRecentProject: (path: string) => void
  loadFromElectron: () => Promise<void>
  saveToElectron: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  preferences: defaultSettings,
  isLoaded: false,

  setPreferences: (prefs) => set({ preferences: prefs, isLoaded: true }),

  updateEditorSetting: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        editor: { ...state.preferences.editor, [key]: value },
      },
    })),

  updateViewerSetting: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        viewer: { ...state.preferences.viewer, [key]: value },
      },
    })),

  updateAgentSetting: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        agent: { ...state.preferences.agent, [key]: value },
      },
    })),

  updateChatSetting: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        chat: { ...state.preferences.chat, [key]: value },
      },
    })),

  updateGitSetting: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        git: { ...state.preferences.git, [key]: value },
      },
    })),

  addRecentProject: (path, name) =>
    set((state) => {
      const filtered = state.preferences.recentProjects.filter(p => p.path !== path)
      const updated = [{ path, name, lastOpened: Date.now() }, ...filtered].slice(0, 10)
      return {
        preferences: { ...state.preferences, recentProjects: updated },
      }
    }),

  removeRecentProject: (path) =>
    set((state) => {
      const filtered = state.preferences.recentProjects.filter(p => p.path !== path)
      return {
        preferences: { ...state.preferences, recentProjects: filtered },
      }
    }),

  loadFromElectron: async () => {
    if (!window.electronAPI) return
    try {
      const prefs = await window.electronAPI.preferences.getAll()
      set({
        preferences: {
          ...defaultSettings,
          ...prefs,
          editor: { ...defaultSettings.editor, ...(prefs.editor ?? {}) },
          compiler: { ...defaultSettings.compiler, ...(prefs.compiler ?? {}) },
          agent: { ...defaultSettings.agent, ...(prefs.agent ?? {}) },
          chat: { ...defaultSettings.chat, ...(prefs.chat ?? {}) },
          viewer: { ...defaultSettings.viewer, ...(prefs.viewer ?? {}) },
          git: { ...defaultSettings.git, ...(prefs.git ?? {}) },
        },
        isLoaded: true,
      })
    } catch {
      // Keep defaults if Electron not available
      set({ isLoaded: true })
    }
  },

  saveToElectron: async () => {
    if (!window.electronAPI) return
    const { preferences } = get()
    try {
      await window.electronAPI.preferences.set('editor', preferences.editor)
      await window.electronAPI.preferences.set('viewer', preferences.viewer)
      await window.electronAPI.preferences.set('compiler', preferences.compiler)
      await window.electronAPI.preferences.set('agent', preferences.agent)
      await window.electronAPI.preferences.set('chat', preferences.chat)
      await window.electronAPI.preferences.set('git', preferences.git)
      await window.electronAPI.preferences.set('language', preferences.language)
      await window.electronAPI.preferences.set('recentProjects', preferences.recentProjects)
      if (preferences.layout) {
        await window.electronAPI.preferences.set('layout', preferences.layout)
      }
    } catch {
      // Silently fail if Electron not available
    }
  },
}))
