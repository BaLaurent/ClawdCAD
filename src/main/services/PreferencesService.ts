import Store from 'electron-store'
import type { Preferences } from '../../shared/types'


const defaultPreferences: Preferences = {
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
  encrypted_api_key: undefined,
}

class PreferencesService {
  private store: Store<Preferences>

  constructor() {
    this.store = new Store<Preferences>({
      defaults: defaultPreferences,
      name: 'ClawdCAD-preferences',
    })
  }

  get<K extends keyof Preferences>(key: K): Preferences[K] {
    return this.store.get(key)
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.store.set(key, value)
  }

  getAll(): Preferences {
    return this.store.store
  }

  reset(): void {
    this.store.clear()
  }

  getPath(): string {
    return this.store.path
  }
}

export const preferencesService = new PreferencesService()
