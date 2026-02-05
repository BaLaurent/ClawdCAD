import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

class FileService {
  private watcher: chokidar.FSWatcher | null = null
  private onChangeCallback: ((event: string, filePath: string) => void) | null = null

  /**
   * Validate path to prevent directory traversal attacks.
   * Ensures the resolved path is within the allowed base directory.
   */
  validatePath(filePath: string, basePath?: string): boolean {
    const resolved = path.resolve(filePath)
    if (basePath) {
      const resolvedBase = path.resolve(basePath)
      return resolved.startsWith(resolvedBase)
    }
    // Block obvious traversal patterns
    if (filePath.includes('..')) {
      const normalized = path.normalize(filePath)
      if (normalized.includes('..')) return false
    }
    return true
  }

  async readFile(filePath: string): Promise<{ content: string; error?: string }> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { content }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { content: '', error: `Failed to read file: ${message}` }
    }
  }

  async saveFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure parent directory exists
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to save file: ${message}` }
    }
  }

  async createFile(filePath: string, content: string = ''): Promise<{ success: boolean; error?: string }> {
    try {
      if (fs.existsSync(filePath)) {
        return { success: false, error: 'File already exists' }
      }
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to create file: ${message}` }
    }
  }

  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' }
      }
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true })
      } else {
        fs.unlinkSync(filePath)
      }
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to delete: ${message}` }
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!fs.existsSync(oldPath)) {
        return { success: false, error: 'Source file does not exist' }
      }
      if (fs.existsSync(newPath)) {
        return { success: false, error: 'Destination already exists' }
      }
      fs.renameSync(oldPath, newPath)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to rename: ${message}` }
    }
  }

  async listDirectory(dirPath: string): Promise<{ files: FileEntry[]; error?: string }> {
    try {
      if (!fs.existsSync(dirPath)) {
        return { files: [], error: 'Directory does not exist' }
      }
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const files: FileEntry[] = []

      // Sort: directories first, then files, both alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      for (const entry of sorted) {
        // Skip hidden files and common non-project dirs
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

        const fullPath = path.join(dirPath, entry.name)
        const fileEntry: FileEntry = {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
        }

        if (entry.isDirectory()) {
          // Recursively list subdirectories (max depth handled by caller)
          const subResult = await this.listDirectory(fullPath)
          fileEntry.children = subResult.files
        }

        files.push(fileEntry)
      }

      return { files }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { files: [], error: `Failed to list directory: ${message}` }
    }
  }

  startWatching(dirPath: string, callback: (event: string, filePath: string) => void): void {
    this.stopWatching()
    this.onChangeCallback = callback
    this.watcher = chokidar.watch(dirPath, {
      ignored: [
        /(^|[/\\])\./,       // Hidden files
        /node_modules/,
        /\.git/,
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 10,
    })

    this.watcher.on('add', (filePath: string) => this.onChangeCallback?.('add', filePath))
    this.watcher.on('change', (filePath: string) => this.onChangeCallback?.('change', filePath))
    this.watcher.on('unlink', (filePath: string) => this.onChangeCallback?.('unlink', filePath))
    this.watcher.on('addDir', (filePath: string) => this.onChangeCallback?.('addDir', filePath))
    this.watcher.on('unlinkDir', (filePath: string) => this.onChangeCallback?.('unlinkDir', filePath))
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    this.onChangeCallback = null
  }
}

export const fileService = new FileService()
