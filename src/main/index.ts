import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { preferencesService } from './services/PreferencesService'

// E2E Debug: Write to stderr immediately to verify module loads
console.error('[E2E Debug] Main process module loading...')
import { openScadRunner } from './services/OpenScadRunner'
import { keystoreService } from './services/KeystoreService'
import { claudeService } from './services/ClaudeService'
import { checkpointService } from './services/CheckpointService'
import { gitService } from './services/GitService'
import { fileService } from './services/FileService'

import type { Preferences } from '../shared/types'
// Detect if running in CI/headless environment and configure Electron accordingly
// This MUST be done before app.whenReady() to avoid GPU crashes
const isCI = process.env.CI === 'true' || !process.env.DISPLAY
if (isCI) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.commandLine.appendSwitch('disable-software-rasterizer')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
  app.commandLine.appendSwitch('no-sandbox') // Required for Docker/sandboxed environments
  app.commandLine.appendSwitch('in-process-gpu') // Force GPU in main process to avoid pthread issues
} else {
  // Bypass Chromium's conservative GPU blocklist for WebGL on Linux
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  // Enable GPU rasterization for faster WebGL init
  app.commandLine.appendSwitch('enable-gpu-rasterization')
  // Force EGL backend — picks the discrete Nvidia GPU over Intel integrated,
  // avoids GBM/Wayland ENOMEM crashes and speeds up WebGL context creation.
  app.commandLine.appendSwitch('use-gl', 'egl')
}

let mainWindow: BrowserWindow | null = null

// Type definition for preferences

// IPC Handlers
ipcMain.handle('ping', async (_event, message: string) => {
  console.log('Main process received ping:', message)
  return `Pong: ${message}`
})

ipcMain.handle('get-platform', async () => {
  return process.platform
})

ipcMain.handle('set-window-title', async (_event, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title)
  }
})

// Preferences IPC Handlers
ipcMain.handle('preferences:get', async (_event, key: string) => {
  return preferencesService.get(key as keyof Preferences)
})

ipcMain.handle('preferences:set', async (_event, key: string, value: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preferencesService.set(key as keyof Preferences, value as any)
  return true
})

ipcMain.handle('preferences:getAll', async () => {
  return preferencesService.getAll()
})

ipcMain.handle('preferences:reset', async () => {
  preferencesService.reset()
  return true
})

ipcMain.handle('preferences:getPath', async () => {
  return preferencesService.getPath()
})

// OpenSCAD IPC Handlers
ipcMain.handle('openscad:compile', async (_event, source: string) => {
  return openScadRunner.compile(source)
})

ipcMain.handle('openscad:check-binary', async () => {
  return openScadRunner.checkBinary()
})

// Keystore IPC Handlers
ipcMain.handle('keystore:set-api-key', async (_event, apiKey: string) => {
  return keystoreService.setApiKey(apiKey)
})

ipcMain.handle('keystore:has-api-key', async () => {
  return keystoreService.hasApiKey()
})

ipcMain.handle('keystore:delete-api-key', async () => {
  return keystoreService.deleteApiKey()
})

// AI Chat IPC Handlers
ipcMain.handle('ai:send-message', async (event, messages: Array<{ role: string; content: string; images?: Array<{ id: string; data: string; mediaType: string }> }>, systemPrompt?: string, projectDir?: string) => {
  const webContents = event.sender
  return claudeService.sendMessage(messages, systemPrompt, projectDir, {
    onToken: (token) => webContents.send('ai:stream-token', token),
    onEnd: () => webContents.send('ai:stream-end'),
    onError: (error) => webContents.send('ai:stream-error', error),
    onToolCallStart: (tc) => webContents.send('ai:tool-call-start', tc),
    onToolCallResult: (tr) => webContents.send('ai:tool-call-result', tr),
  })
})

ipcMain.handle('ai:is-configured', async () => {
  return claudeService.isConfigured()
})

ipcMain.handle('ai:test-agent-sdk', async () => {
  return claudeService.isAgentSDKAvailable()
})

// Checkpoint IPC Handlers
ipcMain.handle('checkpoint:list', async (_event, projectDir: string) => {
  return checkpointService.listCheckpoints(projectDir)
})

ipcMain.handle('checkpoint:undo', async (_event, _projectDir: string, checkpointId: string) => {
  const result = checkpointService.undoCheckpoint(checkpointId)
  return { success: result.restoredFiles.length > 0, restoredFiles: result.restoredFiles }
})

// File System IPC Handlers
ipcMain.handle('file:open-dialog', async (_event, options?: { filters?: Array<{ name: string; extensions: string[] }>; defaultPath?: string }) => {
  if (!mainWindow) return { filePaths: [], canceled: true }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options?.filters ?? [
      { name: 'OpenSCAD Files', extensions: ['scad'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: options?.defaultPath,
  })
  return { filePaths: result.filePaths, canceled: result.canceled }
})

ipcMain.handle('file:open-directory-dialog', async (_event, options?: { defaultPath?: string }) => {
  if (!mainWindow) return { filePaths: [], canceled: true }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: options?.defaultPath,
  })
  return { filePaths: result.filePaths, canceled: result.canceled }
})

// STL Export via save dialog (Feature #30)
ipcMain.handle('file:save-stl', async (_event, buffer: ArrayBuffer) => {
  if (!mainWindow) return { success: false, error: 'No main window' }
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export STL',
      defaultPath: 'model.stl',
      filters: [
        { name: 'STL Files', extensions: ['stl'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled || !result.filePath) {
      return { success: false }
    }
    const fs = await import('fs')
    fs.writeFileSync(result.filePath, Buffer.from(buffer))
    return { success: true, filePath: result.filePath }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `STL export failed: ${message}` }
  }
})

ipcMain.handle('file:save', async (_event, filePath: string, content: string) => {
  if (!fileService.validatePath(filePath)) {
    return { success: false, error: 'Invalid path: directory traversal detected' }
  }
  return fileService.saveFile(filePath, content)
})

ipcMain.handle('file:read', async (_event, filePath: string) => {
  if (!fileService.validatePath(filePath)) {
    return { content: '', error: 'Invalid path: directory traversal detected' }
  }
  return fileService.readFile(filePath)
})

ipcMain.handle('file:create', async (_event, filePath: string, content?: string) => {
  if (!fileService.validatePath(filePath)) {
    return { success: false, error: 'Invalid path: directory traversal detected' }
  }
  return fileService.createFile(filePath, content ?? '')
})

ipcMain.handle('file:create-dir', async (_event, dirPath: string) => {
  if (!fileService.validatePath(dirPath)) {
    return { success: false, error: 'Invalid path: directory traversal detected' }
  }
  try {
    const fs = await import('fs')
    fs.mkdirSync(dirPath, { recursive: true })
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to create directory: ${message}` }
  }
})

ipcMain.handle('file:delete', async (_event, filePath: string) => {
  if (!fileService.validatePath(filePath)) {
    return { success: false, error: 'Invalid path: directory traversal detected' }
  }
  return fileService.deleteFile(filePath)
})

ipcMain.handle('file:rename', async (_event, oldPath: string, newPath: string) => {
  if (!fileService.validatePath(oldPath) || !fileService.validatePath(newPath)) {
    return { success: false, error: 'Invalid path: directory traversal detected' }
  }
  return fileService.renameFile(oldPath, newPath)
})

ipcMain.handle('file:list-dir', async (_event, dirPath: string) => {
  if (!fileService.validatePath(dirPath)) {
    return { files: [], error: 'Invalid path: directory traversal detected' }
  }
  return fileService.listDirectory(dirPath)
})

ipcMain.handle('file:watch', async (event, dirPath: string) => {
  fileService.startWatching(dirPath, (watchEvent, filePath) => {
    event.sender.send('file:changed', watchEvent, filePath)
  })
  return { success: true }
})

ipcMain.handle('file:stop-watch', async () => {
  fileService.stopWatching()
  return { success: true }
})

// Zoom IPC Handlers
ipcMain.handle('zoom:set', async (_event, level: number) => {
  mainWindow?.webContents.setZoomLevel(level)
  return mainWindow?.webContents.getZoomLevel() ?? 0
})

ipcMain.handle('zoom:get', async () => {
  return mainWindow?.webContents.getZoomLevel() ?? 0
})

// Git IPC Handlers
ipcMain.handle('git:init', async (_event, dir: string) => {
  return gitService.init(dir)
})

ipcMain.handle('git:status', async (_event, dir: string) => {
  return gitService.status(dir)
})

ipcMain.handle('git:add', async (_event, dir: string, filepath: string) => {
  return gitService.add(dir, filepath)
})

ipcMain.handle('git:remove', async (_event, dir: string, filepath: string) => {
  return gitService.remove(dir, filepath)
})

ipcMain.handle('git:commit', async (_event, dir: string, message: string, author: { name: string; email: string }) => {
  return gitService.commit(dir, message, author)
})

ipcMain.handle('git:log', async (_event, dir: string, depth?: number) => {
  return gitService.log(dir, depth)
})

// Git Remote Operations (Feature #42)
ipcMain.handle('git:clone', async (_event, url: string, dir: string, token?: string) => {
  return gitService.clone(url, dir, token)
})

ipcMain.handle('git:push', async (_event, dir: string, remote?: string, branch?: string, token?: string) => {
  return gitService.push(dir, remote, branch, token)
})

ipcMain.handle('git:pull', async (_event, dir: string, remote?: string, branch?: string, token?: string) => {
  return gitService.pull(dir, remote, branch, token)
})

ipcMain.handle('git:add-remote', async (_event, dir: string, remote: string, url: string) => {
  return gitService.addRemote(dir, remote, url)
})

ipcMain.handle('git:list-remotes', async (_event, dir: string) => {
  return gitService.listRemotes(dir)
})

// Git Diff Operations (Feature #41)
ipcMain.handle('git:get-file-content', async (_event, dir: string, filepath: string, ref: string) => {
  return gitService.getFileContent(dir, filepath, ref)
})

// Git Branch Operations (Feature #43)
ipcMain.handle('git:current-branch', async (_event, dir: string) => {
  return gitService.currentBranch(dir)
})

ipcMain.handle('git:list-branches', async (_event, dir: string) => {
  return gitService.listBranches(dir)
})

ipcMain.handle('git:create-branch', async (_event, dir: string, name: string) => {
  return gitService.createBranch(dir, name)
})

ipcMain.handle('git:checkout', async (_event, dir: string, branch: string) => {
  return gitService.checkout(dir, branch)
})

ipcMain.handle('git:has-uncommitted-changes', async (_event, dir: string) => {
  return gitService.hasUncommittedChanges(dir)
})

ipcMain.handle('git:discard', async (_event, dir: string, filepath: string) => {
  return gitService.discardFile(dir, filepath)
})

// Git File History Operations
ipcMain.handle('git:file-log', async (_event, dir: string, filepath: string, depth?: number) => {
  return gitService.fileLog(dir, filepath, depth)
})

ipcMain.handle('git:commit-files', async (_event, dir: string, oid: string) => {
  return gitService.getCommitFiles(dir, oid)
})

function createWindow() {
  // Detect if running in CI/headless environment
  const isCI = process.env.CI === 'true' || !process.env.DISPLAY
  console.log(`[E2E Debug] createWindow called, isCI=${isCI}, DISPLAY=${process.env.DISPLAY}`)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: !isCI, // Don't show window in CI
    autoHideMenuBar: true, // Feature #77: Hide default menu for custom app menu bar
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  // Check NODE_ENV first to allow forcing production mode for E2E tests
  const isDev = process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'development' || !app.isPackaged)

  // Set Content Security Policy headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' http://localhost:5173; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:5173 ws://localhost:5173 https://api.anthropic.com; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.anthropic.com; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // In development, load from Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function registerCustomTools() {
  try {
    const sdk = await (Function('return import("@anthropic-ai/claude-agent-sdk")')() as Promise<typeof import('@anthropic-ai/claude-agent-sdk')>)
    const { z } = await (Function('return import("zod/v4")')() as Promise<typeof import('zod/v4')>)

    claudeService.registerTool(
      sdk.tool(
        'compile_openscad',
        'Compile OpenSCAD source code and return compilation output. Use this to verify that OpenSCAD code is valid and get error details.',
        { source: z.string().describe('Complete OpenSCAD source code to compile') },
        async ({ source }) => {
          const result = await openScadRunner.compile(source)
          // Forward compile result to renderer for 3D viewer update
          if (result.success && mainWindow?.webContents) {
            mainWindow.webContents.send('ai:compile-result', result, source)
          }
          const text = result.success
            ? `Compilation OK (${result.duration}ms)${result.stderr ? `\n${result.stderr}` : ''}`
            : `Compilation FAILED (${result.duration}ms)\n${result.stderr}`
          return { content: [{ type: 'text' as const, text }] }
        }
      )
    )
    claudeService.registerTool(
      sdk.tool(
        'capture_viewport',
        'Capture a screenshot of the 3D viewport. Returns the current rendered view as a PNG image. Use this to see what the user sees in the 3D viewer.',
        {},
        async () => {
          if (!mainWindow?.webContents) {
            return { content: [{ type: 'text' as const, text: 'No window available' }] }
          }
          const dataUrl: string = await mainWindow.webContents.executeJavaScript(`
            (function() {
              const canvas = document.querySelector('[data-testid="viewer-canvas"] canvas');
              return canvas ? canvas.toDataURL('image/png') : null;
            })()
          `)
          if (!dataUrl) {
            return { content: [{ type: 'text' as const, text: 'No 3D viewport canvas found — is a model loaded?' }] }
          }
          const base64 = dataUrl.split(',')[1] ?? ''
          // Forward image to renderer for preview (SDK doesn't relay MCP tool results)
          mainWindow.webContents.send('ai:viewport-captured', base64)
          return {
            content: [{
              type: 'image' as const,
              data: base64,
              mimeType: 'image/png'
            }]
          }
        }
      )
    )

    claudeService.registerTool(
      sdk.tool(
        'view_user_attachments',
        'View image(s) the user attached to their message. Returns the images as PNG. Call this when the user mentions attaching images.',
        {},
        async () => {
          const images = claudeService.pendingUserImages
          if (images.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No images attached.' }] }
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content: any[] = []
          for (const img of images) {
            content.push({
              type: 'image' as const,
              data: img.data,
              mimeType: img.mediaType,
            })
          }
          return { content }
        }
      )
    )

    console.log('[ClawdCAD] Custom tools registered:', claudeService.getRegisteredTools().join(', '))
  } catch (err) {
    console.warn('[ClawdCAD] Could not register custom tools (Agent SDK unavailable):', err)
  }
}

app.whenReady().then(async () => {
  console.log('[E2E Debug] App ready, creating window...')
  createWindow()
  console.log('[E2E Debug] Window created')

  // Register custom AI tools (non-blocking, fails gracefully if SDK unavailable)
  registerCustomTools()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
