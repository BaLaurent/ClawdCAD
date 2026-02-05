import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import fs from 'fs'
import path from 'path'

export interface GitFileStatus {
  filepath: string
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'unmodified'
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

class GitService {
  // Feature #50: Validate that directory exists and is accessible
  private validateDir(dir: string): { valid: boolean; error?: string } {
    try {
      // Check if path exists
      if (!fs.existsSync(dir)) {
        return { valid: false, error: 'Directory does not exist' }
      }

      // Check if it's a directory
      const stat = fs.statSync(dir)
      if (!stat.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' }
      }

      // Resolve to absolute path to prevent relative path issues
      const absolute = path.resolve(dir)

      // Basic security check: reject if trying to access root or system dirs
      if (absolute === '/' || absolute === 'C:\\' || absolute === 'C:/') {
        return { valid: false, error: 'Cannot use root directory' }
      }

      return { valid: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { valid: false, error: message }
    }
  }

  async init(dir: string): Promise<{ success: boolean; error?: string }> {
    const validation = this.validateDir(dir)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    try {
      await git.init({ fs, dir })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async status(dir: string): Promise<{ files: GitFileStatus[]; error?: string }> {
    const validation = this.validateDir(dir)
    if (!validation.valid) {
      return { files: [], error: validation.error }
    }

    try {
      const matrix = await git.statusMatrix({ fs, dir })
      const files: GitFileStatus[] = []

      for (const [filepath, head, workdir, stage] of matrix) {
        // Skip unmodified files
        if (head === 1 && workdir === 1 && stage === 1) continue

        let status: 'modified' | 'added' | 'deleted' | 'untracked' | 'unmodified'

        if (head === 0 && workdir === 2 && stage === 0) {
          status = 'untracked'
        } else if (head === 0 && workdir === 2 && stage === 2) {
          status = 'added'
        } else if (head === 1 && workdir === 2 && stage === 1) {
          status = 'modified'
        } else if (head === 1 && workdir === 2 && stage === 2) {
          status = 'modified'
        } else if (head === 1 && workdir === 0 && stage === 0) {
          status = 'deleted'
        } else if (head === 1 && workdir === 0 && stage === 1) {
          status = 'deleted'
        } else if (head === 0 && workdir === 0 && stage === 2) {
          status = 'added'
        } else if (head === 1 && workdir === 2 && stage === 3) {
          status = 'modified'
        } else {
          status = 'modified'
        }

        // Determine if the file is staged
        const isStaged = stage === 2 || stage === 3 || (head === 1 && workdir === 0 && stage === 0)
        files.push({ filepath: filepath as string, status, staged: isStaged })
      }

      return { files }
    } catch (err) {
      // Not a git repo or other error
      const errObj = err as { code?: string; message?: string }
      if (errObj.code === 'NotFoundError' || errObj.message?.includes('not a git')) {
        return { files: [], error: 'Not a git repository' }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { files: [], error: message }
    }
  }

  async add(dir: string, filepath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await git.add({ fs, dir, filepath })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async remove(dir: string, filepath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await git.remove({ fs, dir, filepath })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async commit(
    dir: string,
    message: string,
    author: { name: string; email: string }
  ): Promise<{ success: boolean; oid?: string; error?: string }> {
    try {
      const oid = await git.commit({ fs, dir, message, author })
      return { success: true, oid }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async log(dir: string, depth: number = 20): Promise<{ commits: GitLogEntry[]; error?: string }> {
    try {
      const commits = await git.log({ fs, dir, depth })
      return {
        commits: commits.map((c) => ({
          oid: c.oid,
          message: c.commit.message,
          author: {
            name: c.commit.author.name,
            email: c.commit.author.email,
            timestamp: c.commit.author.timestamp,
          },
        })),
      }
    } catch (err) {
      const errObj = err as { code?: string; message?: string }
      if (errObj.code === 'NotFoundError' || errObj.message?.includes('not a git')) {
        return { commits: [], error: 'Not a git repository' }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { commits: [], error: message }
    }
  }
  // --- Remote Operations (Feature #42) ---

  async clone(
    url: string,
    dir: string,
    token?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!url.startsWith('https://')) {
        return { success: false, error: 'Only HTTPS remotes are supported' }
      }
      await git.clone({
        fs,
        http,
        dir,
        url,
        singleBranch: true,
        depth: 50,
        onAuth: token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined,
      })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async push(
    dir: string,
    remote: string = 'origin',
    branch?: string,
    token?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentBranch = branch || (await git.currentBranch({ fs, dir }))
      if (!currentBranch) {
        return { success: false, error: 'Cannot determine current branch. Detached HEAD?' }
      }
      await git.push({
        fs,
        http,
        dir,
        remote,
        ref: currentBranch,
        onAuth: token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined,
      })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async pull(
    dir: string,
    remote: string = 'origin',
    branch?: string,
    token?: string,
    author?: { name: string; email: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentBranch = branch || (await git.currentBranch({ fs, dir }))
      if (!currentBranch) {
        return { success: false, error: 'Cannot determine current branch. Detached HEAD?' }
      }
      await git.pull({
        fs,
        http,
        dir,
        remote,
        ref: currentBranch,
        singleBranch: true,
        author: author || { name: 'ClawdCAD User', email: 'user@ClawdCAD.local' },
        onAuth: token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined,
      })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.toLowerCase().includes('conflict') || message.includes('MergeConflict')) {
        return { success: false, error: 'Merge conflict detected. Please resolve conflicts manually.' }
      }
      return { success: false, error: message }
    }
  }

  async addRemote(
    dir: string,
    remote: string,
    url: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await git.addRemote({ fs, dir, remote, url })
      return { success: true }
    } catch (err) {
      const errObj = err as { message?: string }
      if (errObj.message?.includes('already exists')) {
        // Update existing remote by removing and re-adding
        try {
          await git.deleteRemote({ fs, dir, remote })
          await git.addRemote({ fs, dir, remote, url })
          return { success: true }
        } catch (innerErr) {
          const innerMessage = innerErr instanceof Error ? innerErr.message : String(innerErr)
          return { success: false, error: innerMessage }
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async listRemotes(dir: string): Promise<{ remotes: Array<{ remote: string; url: string }>; error?: string }> {
    try {
      const remotes = await git.listRemotes({ fs, dir })
      return { remotes }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { remotes: [], error: message }
    }
  }

  // --- Diff Operations (Feature #41) ---

  private validateFilePath(dir: string, filepath: string): { valid: boolean; error?: string } {
    const resolved = path.resolve(dir, filepath)
    if (!resolved.startsWith(path.resolve(dir))) {
      return { valid: false, error: 'Path traversal detected' }
    }
    return { valid: true }
  }

  async getFileContent(dir: string, filepath: string, ref: string): Promise<{ content: string; error?: string }> {
    const pathCheck = this.validateFilePath(dir, filepath)
    if (!pathCheck.valid) {
      return { content: '', error: pathCheck.error }
    }

    try {
      if (ref === 'WORKDIR') {
        // Read from working directory
        const fullPath = path.join(dir, filepath)
        const content = fs.readFileSync(fullPath, 'utf8')
        return { content }
      }

      if (ref === 'STAGE') {
        // Read HEAD version as the "original" side of a staged diff
        const { blob } = await git.readBlob({
          fs,
          dir,
          oid: await git.resolveRef({ fs, dir, ref: 'HEAD' }),
          filepath,
        })
        return { content: new TextDecoder().decode(blob) }
      }

      // Read from a specific ref (HEAD, commit oid, etc.)
      const oid = await git.resolveRef({ fs, dir, ref })
      const { blob } = await git.readBlob({ fs, dir, oid, filepath })
      return { content: new TextDecoder().decode(blob) }
    } catch (err) {
      // File doesn't exist in that ref (e.g., new file)
      const message = err instanceof Error ? err.message : String(err)
      return { content: '', error: message }
    }
  }

  // --- Branch Operations (Feature #43) ---

  async currentBranch(dir: string): Promise<{ branch: string | null; error?: string }> {
    try {
      const branch = await git.currentBranch({ fs, dir, fullname: false })
      return { branch: branch || null }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { branch: null, error: message }
    }
  }

  async listBranches(dir: string): Promise<{ branches: GitBranchInfo[]; error?: string }> {
    try {
      const branchNames = await git.listBranches({ fs, dir })
      const current = await git.currentBranch({ fs, dir, fullname: false })
      const branches: GitBranchInfo[] = branchNames.map((name) => ({
        name,
        current: name === current,
      }))
      return { branches }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { branches: [], error: message }
    }
  }

  async createBranch(dir: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
      await git.branch({ fs, dir, ref: name })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async checkout(dir: string, branch: string): Promise<{ success: boolean; error?: string }> {
    try {
      await git.checkout({ fs, dir, ref: branch })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async discardFile(dir: string, filepath: string): Promise<{ success: boolean; error?: string }> {
    const pathCheck = this.validateFilePath(dir, filepath)
    if (!pathCheck.valid) {
      return { success: false, error: pathCheck.error }
    }

    try {
      await git.checkout({ fs, dir, filepaths: [filepath] })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  // --- File History Operations ---

  async fileLog(dir: string, filepath: string, depth: number = 50): Promise<{ commits: GitLogEntry[]; error?: string }> {
    const pathCheck = this.validateFilePath(dir, filepath)
    if (!pathCheck.valid) {
      return { commits: [], error: pathCheck.error }
    }

    try {
      const commits = await git.log({ fs, dir, depth, filepath })
      return {
        commits: commits.map((c) => ({
          oid: c.oid,
          message: c.commit.message,
          author: {
            name: c.commit.author.name,
            email: c.commit.author.email,
            timestamp: c.commit.author.timestamp,
          },
        })),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { commits: [], error: message }
    }
  }

  async getCommitFiles(dir: string, oid: string): Promise<{ files: Array<{ filepath: string; status: 'added' | 'modified' | 'deleted' }>; error?: string }> {
    try {
      const commitData = await git.readCommit({ fs, dir, oid })
      const parentOids = commitData.commit.parent

      // For root commit (no parents), all files are 'added'
      const parentOid = parentOids.length > 0 ? parentOids[0] : null

      const files: Array<{ filepath: string; status: 'added' | 'modified' | 'deleted' }> = []

      // Build file maps for parent and current commit
      const parentFiles = new Map<string, string>()
      const currentFiles = new Map<string, string>()

      if (parentOid) {
        await git.walk({
          fs,
          dir,
          trees: [git.TREE({ ref: parentOid })],
          map: async (filepath, [entry]) => {
            if (filepath === '.') return undefined
            if (!entry) return undefined
            const type = await entry.type()
            if (type !== 'blob') return undefined
            const entryOid = await entry.oid()
            parentFiles.set(filepath, entryOid)
            return undefined
          },
        })
      }

      await git.walk({
        fs,
        dir,
        trees: [git.TREE({ ref: oid })],
        map: async (filepath, [entry]) => {
          if (filepath === '.') return undefined
          if (!entry) return undefined
          const type = await entry.type()
          if (type !== 'blob') return undefined
          const entryOid = await entry.oid()
          currentFiles.set(filepath, entryOid)
          return undefined
        },
      })

      // Compare: find added and modified
      for (const [filepath, blobOid] of currentFiles) {
        const parentBlobOid = parentFiles.get(filepath)
        if (!parentBlobOid) {
          files.push({ filepath, status: 'added' })
        } else if (parentBlobOid !== blobOid) {
          files.push({ filepath, status: 'modified' })
        }
      }

      // Find deleted
      for (const filepath of parentFiles.keys()) {
        if (!currentFiles.has(filepath)) {
          files.push({ filepath, status: 'deleted' })
        }
      }

      // Sort by filepath for consistent ordering
      files.sort((a, b) => a.filepath.localeCompare(b.filepath))

      return { files }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { files: [], error: message }
    }
  }

  async hasUncommittedChanges(dir: string): Promise<boolean> {
    try {
      const result = await this.status(dir)
      return result.files.length > 0
    } catch {
      return false
    }
  }
}

export const gitService = new GitService()
