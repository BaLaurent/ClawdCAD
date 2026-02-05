import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  // IPC methods
  ping: (message: string) => ipcRenderer.invoke('ping', message),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  setWindowTitle: (title: string) => ipcRenderer.invoke('set-window-title', title),
  // Preferences
  preferences: {
    get: (key: string) => ipcRenderer.invoke('preferences:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('preferences:set', key, value),
    getAll: () => ipcRenderer.invoke('preferences:getAll'),
    reset: () => ipcRenderer.invoke('preferences:reset'),
    getPath: () => ipcRenderer.invoke('preferences:getPath'),
  },
  // OpenSCAD
  openscad: {
    compile: (source: string) => ipcRenderer.invoke('openscad:compile', source),
    checkBinary: () => ipcRenderer.invoke('openscad:check-binary'),
  },
  // Keystore (secure API key storage)
  keystore: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('keystore:set-api-key', apiKey),
    hasApiKey: () => ipcRenderer.invoke('keystore:has-api-key'),
    deleteApiKey: () => ipcRenderer.invoke('keystore:delete-api-key'),
  },
  // AI Chat
  ai: {
    sendMessage: (messages: Array<{ role: string; content: string; images?: Array<{ id: string; data: string; mediaType: string }> }>, systemPrompt?: string, projectDir?: string) =>
      ipcRenderer.invoke('ai:send-message', messages, systemPrompt, projectDir),
    isConfigured: () => ipcRenderer.invoke('ai:is-configured'),
    testAgentSdk: () => ipcRenderer.invoke('ai:test-agent-sdk'),
    onStreamToken: (callback: (token: string) => void) => {
      const listener = (_event: unknown, token: string) => callback(token)
      ipcRenderer.on('ai:stream-token', listener)
      return () => ipcRenderer.removeListener('ai:stream-token', listener)
    },
    onStreamEnd: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('ai:stream-end', listener)
      return () => ipcRenderer.removeListener('ai:stream-end', listener)
    },
    onStreamError: (callback: (error: string) => void) => {
      const listener = (_event: unknown, error: string) => callback(error)
      ipcRenderer.on('ai:stream-error', listener)
      return () => ipcRenderer.removeListener('ai:stream-error', listener)
    },
    onToolCallStart: (callback: (toolCall: unknown) => void) => {
      const listener = (_event: unknown, toolCall: unknown) => callback(toolCall)
      ipcRenderer.on('ai:tool-call-start', listener)
      return () => ipcRenderer.removeListener('ai:tool-call-start', listener)
    },
    onToolCallResult: (callback: (result: unknown) => void) => {
      const listener = (_event: unknown, result: unknown) => callback(result)
      ipcRenderer.on('ai:tool-call-result', listener)
      return () => ipcRenderer.removeListener('ai:tool-call-result', listener)
    },
    onCompileResult: (callback: (result: unknown, source: string) => void) => {
      const listener = (_event: unknown, result: unknown, source: string) => callback(result, source)
      ipcRenderer.on('ai:compile-result', listener)
      return () => ipcRenderer.removeListener('ai:compile-result', listener)
    },
    onCheckpointCreated: (callback: (checkpoint: unknown) => void) => {
      const listener = (_event: unknown, checkpoint: unknown) => callback(checkpoint)
      ipcRenderer.on('ai:checkpoint-created', listener)
      return () => ipcRenderer.removeListener('ai:checkpoint-created', listener)
    },
    onViewportCaptured: (callback: (imageData: string) => void) => {
      const listener = (_event: unknown, imageData: string) => callback(imageData)
      ipcRenderer.on('ai:viewport-captured', listener)
      return () => ipcRenderer.removeListener('ai:viewport-captured', listener)
    },
  },
  // Checkpoints
  checkpoint: {
    list: (projectDir: string) => ipcRenderer.invoke('checkpoint:list', projectDir),
    undo: (projectDir: string, checkpointId: string) => ipcRenderer.invoke('checkpoint:undo', projectDir, checkpointId),
  },
  // File System
  file: {
    openDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }>; defaultPath?: string }) =>
      ipcRenderer.invoke('file:open-dialog', options),
    openDirectoryDialog: (options?: { defaultPath?: string }) =>
      ipcRenderer.invoke('file:open-directory-dialog', options),
    save: (filePath: string, content: string) =>
      ipcRenderer.invoke('file:save', filePath, content),
    saveStl: (buffer: ArrayBuffer) =>
      ipcRenderer.invoke('file:save-stl', buffer),
    read: (filePath: string) =>
      ipcRenderer.invoke('file:read', filePath),
    create: (filePath: string, content?: string) =>
      ipcRenderer.invoke('file:create', filePath, content),
    createDir: (dirPath: string) =>
      ipcRenderer.invoke('file:create-dir', dirPath),
    delete: (filePath: string) =>
      ipcRenderer.invoke('file:delete', filePath),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('file:rename', oldPath, newPath),
    listDir: (dirPath: string) =>
      ipcRenderer.invoke('file:list-dir', dirPath),
    watch: (dirPath: string) =>
      ipcRenderer.invoke('file:watch', dirPath),
    stopWatch: () =>
      ipcRenderer.invoke('file:stop-watch'),
    onFileChanged: (callback: (event: string, filePath: string) => void) => {
      const listener = (_event: unknown, watchEvent: string, filePath: string) => callback(watchEvent, filePath)
      ipcRenderer.on('file:changed', listener)
      return () => ipcRenderer.removeListener('file:changed', listener)
    },
  },
  // Zoom
  zoom: {
    set: (level: number) => ipcRenderer.invoke('zoom:set', level),
    get: () => ipcRenderer.invoke('zoom:get'),
  },
  // Git
  git: {
    init: (dir: string) => ipcRenderer.invoke('git:init', dir),
    status: (dir: string) => ipcRenderer.invoke('git:status', dir),
    add: (dir: string, filepath: string) => ipcRenderer.invoke('git:add', dir, filepath),
    remove: (dir: string, filepath: string) => ipcRenderer.invoke('git:remove', dir, filepath),
    commit: (dir: string, message: string, author: { name: string; email: string }) =>
      ipcRenderer.invoke('git:commit', dir, message, author),
    log: (dir: string, depth?: number) => ipcRenderer.invoke('git:log', dir, depth),
    // Remote operations
    clone: (url: string, dir: string, token?: string) =>
      ipcRenderer.invoke('git:clone', url, dir, token),
    push: (dir: string, remote?: string, branch?: string, token?: string) =>
      ipcRenderer.invoke('git:push', dir, remote, branch, token),
    pull: (dir: string, remote?: string, branch?: string, token?: string) =>
      ipcRenderer.invoke('git:pull', dir, remote, branch, token),
    addRemote: (dir: string, remote: string, url: string) =>
      ipcRenderer.invoke('git:add-remote', dir, remote, url),
    listRemotes: (dir: string) =>
      ipcRenderer.invoke('git:list-remotes', dir),
    // Diff operations
    getFileContent: (dir: string, filepath: string, ref: string) =>
      ipcRenderer.invoke('git:get-file-content', dir, filepath, ref),
    // Branch operations
    currentBranch: (dir: string) => ipcRenderer.invoke('git:current-branch', dir),
    listBranches: (dir: string) => ipcRenderer.invoke('git:list-branches', dir),
    createBranch: (dir: string, name: string) => ipcRenderer.invoke('git:create-branch', dir, name),
    checkout: (dir: string, branch: string) => ipcRenderer.invoke('git:checkout', dir, branch),
    hasUncommittedChanges: (dir: string) => ipcRenderer.invoke('git:has-uncommitted-changes', dir),
    discard: (dir: string, filepath: string) => ipcRenderer.invoke('git:discard', dir, filepath),
    // File history operations
    fileLog: (dir: string, filepath: string, depth?: number) =>
      ipcRenderer.invoke('git:file-log', dir, filepath, depth),
    commitFiles: (dir: string, oid: string) =>
      ipcRenderer.invoke('git:commit-files', dir, oid),
  },
})
