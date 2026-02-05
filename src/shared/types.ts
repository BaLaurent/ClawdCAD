// Shared types between main and renderer processes

export interface CompileResult {
  success: boolean
  stlBuffer: ArrayBuffer | null
  offData: string | null
  stderr: string
  duration: number
}

export interface BinaryCheckResult {
  exists: boolean
  path: string
  version: string
}

export type PanelId = 'fileTree' | 'editor' | 'viewer' | 'console' | 'chat' | 'git'
export type LayoutZone = 'left' | 'centerTop' | 'centerBottom' | 'right'

export interface PanelConfig {
  id: PanelId
  zone: LayoutZone
  order: number
  visible: boolean
}

export interface LayoutConfig {
  panels: PanelConfig[]
  leftWidth: number
  rightWidth: number
  viewerHeight: number
  consoleHeight: number
}

export interface Preferences {
  editor: {
    theme: 'dark' | 'light'
    fontSize: number
    tabSize: number
    autoCompile: boolean
    autoCompileDelay: number
  }
  compiler: {
    timeout: number
  }
  agent: {
    maxIterations: number
    maxTokens: number
  }
  chat: {
    maxTokens: number
  }
  viewer: {
    backgroundColor: string
    showGrid: boolean
    showAxes: boolean
  }
  git: {
    authorName: string
    authorEmail: string
  }
  language: 'fr' | 'en'
  recentProjects: Array<{ path: string; name: string; lastOpened: number }>
  encrypted_api_key?: string
  layout?: LayoutConfig
}

export interface ToolCallBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
  imageData?: string   // base64-encoded PNG from image tool results
}

export interface Checkpoint {
  id: string
  timestamp: number
  description: string
  files: Array<{ path: string; originalContent: string | null }>
}

export interface ImageAttachment {
  id: string
  data: string         // raw base64, no data: prefix
  mediaType: string    // MIME type, e.g. 'image/png'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: ImageAttachment[]
  toolCalls?: ToolCallBlock[]
  toolResults?: ToolResultBlock[]
  toolExecution?: { call: ToolCallBlock; result?: ToolResultBlock }
  timestamp: number
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

export type GitFileStatusType = 'modified' | 'added' | 'deleted' | 'untracked' | 'unmodified'

export interface GitFileStatus {
  filepath: string
  status: GitFileStatusType
  staged: boolean
}

export interface GitLogEntry {
  oid: string
  message: string
  author: {
    name: string
    email: string
    timestamp: number
  }
}

export interface GitBranchInfo {
  name: string
  current: boolean
}

export interface CommitFileEntry {
  filepath: string
  status: 'added' | 'modified' | 'deleted'
}

export interface ElectronAPI {
  platform: string
  ping: (message: string) => Promise<string>
  getPlatform: () => Promise<string>
  setWindowTitle: (title: string) => Promise<void>
  preferences: {
    get: <K extends keyof Preferences>(key: K) => Promise<Preferences[K]>
    set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<boolean>
    getAll: () => Promise<Preferences>
    reset: () => Promise<boolean>
    getPath: () => Promise<string>
  }
  openscad: {
    compile: (source: string) => Promise<CompileResult>
    checkBinary: () => Promise<BinaryCheckResult>
  }
  keystore: {
    setApiKey: (apiKey: string) => Promise<boolean>
    hasApiKey: () => Promise<boolean>
    deleteApiKey: () => Promise<boolean>
  }
  ai: {
    sendMessage: (messages: Array<{ role: string; content: string; images?: ImageAttachment[] }>, systemPrompt?: string, projectDir?: string) => Promise<void>
    isConfigured: () => Promise<boolean>
    testAgentSdk: () => Promise<boolean>
    onStreamToken: (callback: (token: string) => void) => () => void
    onStreamEnd: (callback: () => void) => () => void
    onStreamError: (callback: (error: string) => void) => () => void
    onToolCallStart: (callback: (toolCall: ToolCallBlock) => void) => () => void
    onToolCallResult: (callback: (result: ToolResultBlock) => void) => () => void
    onCompileResult: (callback: (result: CompileResult, source: string) => void) => () => void
    onCheckpointCreated: (callback: (checkpoint: Checkpoint) => void) => () => void
    onViewportCaptured: (callback: (imageData: string) => void) => () => void
  }
  checkpoint: {
    list: (projectDir: string) => Promise<Checkpoint[]>
    undo: (projectDir: string, checkpointId: string) => Promise<{ success: boolean; restoredFiles: string[] }>
  }
  file: {
    openDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }>; defaultPath?: string }) => Promise<{ filePaths: string[]; canceled: boolean }>
    openDirectoryDialog: (options?: { defaultPath?: string }) => Promise<{ filePaths: string[]; canceled: boolean }>
    save: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
    saveStl: (buffer: ArrayBuffer) => Promise<{ success: boolean; filePath?: string; error?: string }>
    read: (filePath: string) => Promise<{ content: string; error?: string }>
    create: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>
    createDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
    delete: (filePath: string) => Promise<{ success: boolean; error?: string }>
    rename: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
    listDir: (dirPath: string) => Promise<{ files: FileEntry[]; error?: string }>
    watch: (dirPath: string) => Promise<{ success: boolean }>
    stopWatch: () => Promise<{ success: boolean }>
    onFileChanged: (callback: (event: string, filePath: string) => void) => () => void
  }
  zoom: {
    set: (level: number) => Promise<number>
    get: () => Promise<number>
  }
  git: {
    init: (dir: string) => Promise<{ success: boolean; error?: string }>
    status: (dir: string) => Promise<{ files: GitFileStatus[]; error?: string }>
    add: (dir: string, filepath: string) => Promise<{ success: boolean; error?: string }>
    remove: (dir: string, filepath: string) => Promise<{ success: boolean; error?: string }>
    commit: (dir: string, message: string, author: { name: string; email: string }) => Promise<{ success: boolean; oid?: string; error?: string }>
    log: (dir: string, depth?: number) => Promise<{ commits: GitLogEntry[]; error?: string }>
    // Remote operations
    clone: (url: string, dir: string, token?: string) => Promise<{ success: boolean; error?: string }>
    push: (dir: string, remote?: string, branch?: string, token?: string) => Promise<{ success: boolean; error?: string }>
    pull: (dir: string, remote?: string, branch?: string, token?: string) => Promise<{ success: boolean; error?: string }>
    addRemote: (dir: string, remote: string, url: string) => Promise<{ success: boolean; error?: string }>
    listRemotes: (dir: string) => Promise<{ remotes: Array<{ remote: string; url: string }>; error?: string }>
    // Diff operations
    getFileContent: (dir: string, filepath: string, ref: string) => Promise<{ content: string; error?: string }>
    // Branch operations
    currentBranch: (dir: string) => Promise<{ branch: string | null; error?: string }>
    listBranches: (dir: string) => Promise<{ branches: GitBranchInfo[]; error?: string }>
    createBranch: (dir: string, name: string) => Promise<{ success: boolean; error?: string }>
    checkout: (dir: string, branch: string) => Promise<{ success: boolean; error?: string }>
    hasUncommittedChanges: (dir: string) => Promise<boolean>
    discard: (dir: string, filepath: string) => Promise<{ success: boolean; error?: string }>
    // File history operations
    fileLog: (dir: string, filepath: string, depth?: number) => Promise<{ commits: GitLogEntry[]; error?: string }>
    commitFiles: (dir: string, oid: string) => Promise<{ files: CommitFileEntry[]; error?: string }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
