import { vi } from 'vitest'

// Conditionally import jest-dom matchers (only available in jsdom)
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
}

// Skip electronAPI setup in Node environment (main process tests)
if (typeof window !== 'undefined') {
  const mockElectronAPI = {
    platform: 'linux',
    ping: vi.fn().mockResolvedValue('pong'),
    getPlatform: vi.fn().mockResolvedValue('linux'),
    setWindowTitle: vi.fn().mockResolvedValue(undefined),
    preferences: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(true),
      getAll: vi.fn().mockResolvedValue({
        editor: { theme: 'dark', fontSize: 14, tabSize: 4, autoCompile: true, autoCompileDelay: 1500 },
        compiler: { timeout: 30000 },
        agent: { maxIterations: 5, maxTokens: 50000 },
        viewer: { backgroundColor: '#1a1a2e', showGrid: true, showAxes: true },
        language: 'fr',
        recentProjects: [],
      }),
      reset: vi.fn().mockResolvedValue(true),
      getPath: vi.fn().mockResolvedValue('/tmp/ClawdCAD-preferences.json'),
    },
    openscad: {
      compile: vi.fn().mockResolvedValue({ success: false, stlBuffer: null, offData: null, stderr: 'mock', duration: 0 }),
      checkBinary: vi.fn().mockResolvedValue({ exists: false, path: '', version: '' }),
    },
    keystore: {
      setApiKey: vi.fn().mockResolvedValue(true),
      hasApiKey: vi.fn().mockResolvedValue(false),
      deleteApiKey: vi.fn().mockResolvedValue(true),
    },
    ai: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      isConfigured: vi.fn().mockResolvedValue(false),
      testAgentSdk: vi.fn().mockResolvedValue(false),
      onStreamToken: vi.fn().mockReturnValue(() => {}),
      onStreamEnd: vi.fn().mockReturnValue(() => {}),
      onStreamError: vi.fn().mockReturnValue(() => {}),
      onToolCallStart: vi.fn().mockReturnValue(() => {}),
      onToolCallResult: vi.fn().mockReturnValue(() => {}),
      onCompileResult: vi.fn().mockReturnValue(() => {}),
      onCheckpointCreated: vi.fn().mockReturnValue(() => {}),
      onViewportCaptured: vi.fn().mockReturnValue(() => {}),
    },
    file: {
      openDialog: vi.fn().mockResolvedValue({ filePaths: [], canceled: true }),
      openDirectoryDialog: vi.fn().mockResolvedValue({ filePaths: [], canceled: true }),
      save: vi.fn().mockResolvedValue({ success: true }),
      saveStl: vi.fn().mockResolvedValue({ success: true }),
      read: vi.fn().mockResolvedValue({ content: '' }),
      create: vi.fn().mockResolvedValue({ success: true }),
      createDir: vi.fn().mockResolvedValue({ success: true }),
      delete: vi.fn().mockResolvedValue({ success: true }),
      rename: vi.fn().mockResolvedValue({ success: true }),
      listDir: vi.fn().mockResolvedValue({ files: [] }),
      watch: vi.fn().mockResolvedValue({ success: true }),
      stopWatch: vi.fn().mockResolvedValue({ success: true }),
      onFileChanged: vi.fn().mockReturnValue(() => {}),
    },
    git: {
      init: vi.fn().mockResolvedValue({ success: true }),
      status: vi.fn().mockResolvedValue({ files: [] }),
      add: vi.fn().mockResolvedValue({ success: true }),
      remove: vi.fn().mockResolvedValue({ success: true }),
      commit: vi.fn().mockResolvedValue({ success: true, oid: 'abc123' }),
      log: vi.fn().mockResolvedValue({ commits: [] }),
      clone: vi.fn().mockResolvedValue({ success: true }),
      push: vi.fn().mockResolvedValue({ success: true }),
      pull: vi.fn().mockResolvedValue({ success: true }),
      addRemote: vi.fn().mockResolvedValue({ success: true }),
      listRemotes: vi.fn().mockResolvedValue({ remotes: [] }),
      getFileContent: vi.fn().mockResolvedValue({ content: '' }),
      currentBranch: vi.fn().mockResolvedValue({ branch: 'main' }),
      listBranches: vi.fn().mockResolvedValue({ branches: [] }),
      createBranch: vi.fn().mockResolvedValue({ success: true }),
      checkout: vi.fn().mockResolvedValue({ success: true }),
      hasUncommittedChanges: vi.fn().mockResolvedValue(false),
      discard: vi.fn().mockResolvedValue({ success: true }),
      fileLog: vi.fn().mockResolvedValue({ commits: [] }),
      commitFiles: vi.fn().mockResolvedValue({ files: [] }),
    },
  }

  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
    configurable: true,
  })
}
