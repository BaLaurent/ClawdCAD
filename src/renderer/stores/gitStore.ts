import { create } from 'zustand'
import { GitFileStatus, GitLogEntry, GitBranchInfo, CommitFileEntry } from '../../shared/types'
import { useSettingsStore } from './settingsStore'

interface DiffState {
  isOpen: boolean
  filepath: string
  original: string
  modified: string
  isStaged: boolean
}

interface GitState {
  // File status
  stagedFiles: GitFileStatus[]
  unstagedFiles: GitFileStatus[]
  isLoading: boolean
  error: string | null

  // Commit
  commitMessage: string
  isCommitting: boolean

  // Commit history
  commits: GitLogEntry[]
  isLoadingHistory: boolean

  // Project directory
  projectDir: string

  // Repository status (Feature #51)
  isGitRepo: boolean
  isCheckingRepo: boolean

  // Remote operations (Feature #42)
  remoteUrl: string
  isPushing: boolean
  isPulling: boolean
  remoteError: string | null
  remoteSuccess: string | null

  // Diff state (Feature #41)
  diff: DiffState

  // Branch state (Feature #43)
  currentBranch: string | null
  branches: GitBranchInfo[]
  isLoadingBranches: boolean
  showCreateBranch: boolean
  newBranchName: string

  // Expanded commit in GitPanel
  expandedCommitOid: string | null
  commitFilesForExpanded: CommitFileEntry[]
  isLoadingCommitFiles: boolean

  // File history overlay
  fileHistory: {
    isOpen: boolean
    filepath: string
    commits: GitLogEntry[]
    isLoading: boolean
  }

  // Version preview overlay
  versionPreview: {
    isOpen: boolean
    filepath: string
    oid: string
    commitMessage: string
    content: string
    isLoading: boolean
  }

  // Actions
  setProjectDir: (dir: string) => void
  setCommitMessage: (msg: string) => void
  refreshStatus: () => Promise<void>
  stageFile: (filepath: string) => Promise<void>
  unstageFile: (filepath: string) => Promise<void>
  commit: (author: { name: string; email: string }) => Promise<{ success: boolean; oid?: string; error?: string }>
  refreshHistory: () => Promise<void>
  initRepo: (createInitialCommit?: boolean) => Promise<{ success: boolean; error?: string }>
  checkIsGitRepo: () => Promise<void>

  // Discard action
  discardFile: (filepath: string) => Promise<{ success: boolean; error?: string }>

  // Remote actions (Feature #42)
  setRemoteUrl: (url: string) => void
  push: (token?: string) => Promise<void>
  pull: (token?: string) => Promise<void>
  configureRemote: (url: string) => Promise<void>
  clearRemoteMessages: () => void

  // Diff actions (Feature #41)
  openDiff: (filepath: string, isStaged: boolean) => Promise<void>
  closeDiff: () => void

  // Branch actions (Feature #43)
  refreshBranches: () => Promise<void>
  switchBranch: (branch: string) => Promise<{ success: boolean; error?: string }>
  createBranch: (name: string) => Promise<{ success: boolean; error?: string }>
  setShowCreateBranch: (show: boolean) => void
  setNewBranchName: (name: string) => void

  // File history actions
  toggleCommitExpand: (oid: string) => Promise<void>
  openFileHistory: (filepath: string) => Promise<void>
  closeFileHistory: () => void
  openVersionPreview: (filepath: string, oid: string, commitMessage: string) => Promise<void>
  closeVersionPreview: () => void
}

export const useGitStore = create<GitState>((set, get) => ({
  stagedFiles: [],
  unstagedFiles: [],
  isLoading: false,
  error: null,
  commitMessage: '',
  isCommitting: false,
  commits: [],
  isLoadingHistory: false,
  projectDir: '',

  // Repository status (Feature #51)
  isGitRepo: false,
  isCheckingRepo: false,

  // Remote state
  remoteUrl: '',
  isPushing: false,
  isPulling: false,
  remoteError: null,
  remoteSuccess: null,

  // Diff state
  diff: {
    isOpen: false,
    filepath: '',
    original: '',
    modified: '',
    isStaged: false,
  },

  // Branch state
  currentBranch: null,
  branches: [],
  isLoadingBranches: false,
  showCreateBranch: false,
  newBranchName: '',

  // Expanded commit state
  expandedCommitOid: null,
  commitFilesForExpanded: [],
  isLoadingCommitFiles: false,

  // File history state
  fileHistory: {
    isOpen: false,
    filepath: '',
    commits: [],
    isLoading: false,
  },

  // Version preview state
  versionPreview: {
    isOpen: false,
    filepath: '',
    oid: '',
    commitMessage: '',
    content: '',
    isLoading: false,
  },

  setProjectDir: (dir) => set({ projectDir: dir }),
  setCommitMessage: (msg) => set({ commitMessage: msg }),

  checkIsGitRepo: async () => {
    const { projectDir } = get()
    if (!projectDir) {
      set({ isGitRepo: false })
      return
    }

    set({ isCheckingRepo: true })

    try {
      if (window.electronAPI?.git) {
        const result = await window.electronAPI.git.status(projectDir)
        // If error contains "not a git" or "Not a git", it's not a repo
        if (result.error && (result.error.toLowerCase().includes('not a git') || result.error.includes('Not a git'))) {
          set({ isGitRepo: false, isCheckingRepo: false })
        } else {
          set({ isGitRepo: true, isCheckingRepo: false })
        }
      } else {
        // Browser mode: assume it's a repo for demo
        set({ isGitRepo: true, isCheckingRepo: false })
      }
    } catch (err: unknown) {
      set({ isGitRepo: false, isCheckingRepo: false })
    }
  },

  refreshStatus: async () => {
    const { projectDir } = get()
    if (!projectDir) return

    set({ isLoading: true, error: null })

    try {
      if (window.electronAPI?.git) {
        const result = await window.electronAPI.git.status(projectDir)
        if (result.error) {
          // Check if it's a "not a git repo" error (Feature #51)
          if (result.error.toLowerCase().includes('not a git') || result.error.includes('Not a git')) {
            set({ isGitRepo: false, error: result.error, stagedFiles: [], unstagedFiles: [], isLoading: false })
          } else {
            set({ error: result.error, stagedFiles: [], unstagedFiles: [], isLoading: false })
          }
          return
        }
        const staged = result.files.filter((f: GitFileStatus) => f.staged)
        const unstaged = result.files.filter((f: GitFileStatus) => !f.staged)
        set({ stagedFiles: staged, unstagedFiles: unstaged, isLoading: false, isGitRepo: true })
      } else {
        // Browser mode: demo data
        set({
          stagedFiles: [],
          unstagedFiles: [
            { filepath: 'phone_stand.scad', status: 'modified', staged: false },
            { filepath: 'gear.scad', status: 'untracked', staged: false },
          ],
          isLoading: false,
          isGitRepo: true,
        })
      }
    } catch (err) {
      const errObj = err as { message?: string }
      set({ error: errObj.message || 'Failed to get git status', isLoading: false })
    }
  },

  stageFile: async (filepath) => {
    const { projectDir } = get()
    if (!projectDir) return

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.add(projectDir, filepath)
      if (result.error) {
        set({ error: result.error })
        return
      }
    }

    // Optimistic update: move file from unstaged to staged
    const { unstagedFiles, stagedFiles } = get()
    const file = unstagedFiles.find((f) => f.filepath === filepath)
    if (file) {
      set({
        unstagedFiles: unstagedFiles.filter((f) => f.filepath !== filepath),
        stagedFiles: [...stagedFiles, { ...file, staged: true }],
      })
    }

    // Refresh to get actual state
    if (window.electronAPI?.git) {
      await get().refreshStatus()
    }
  },

  unstageFile: async (filepath) => {
    const { projectDir } = get()
    if (!projectDir) return

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.remove(projectDir, filepath)
      if (result.error) {
        set({ error: result.error })
        return
      }
    }

    // Optimistic update: move file from staged to unstaged
    const { stagedFiles, unstagedFiles } = get()
    const file = stagedFiles.find((f) => f.filepath === filepath)
    if (file) {
      set({
        stagedFiles: stagedFiles.filter((f) => f.filepath !== filepath),
        unstagedFiles: [...unstagedFiles, { ...file, staged: false }],
      })
    }

    if (window.electronAPI?.git) {
      await get().refreshStatus()
    }
  },

  commit: async (author) => {
    const { projectDir, commitMessage } = get()
    if (!projectDir || !commitMessage.trim()) {
      return { success: false, error: 'No project directory or commit message' }
    }

    set({ isCommitting: true })

    try {
      if (window.electronAPI?.git) {
        const result = await window.electronAPI.git.commit(projectDir, commitMessage, author)
        if (result.success) {
          set({ commitMessage: '', isCommitting: false })
          await get().refreshStatus()
          await get().refreshHistory()
          return result
        }
        set({ isCommitting: false, error: result.error || 'Commit failed' })
        return result
      } else {
        // Browser mode: simulate
        set({ commitMessage: '', isCommitting: false })
        return { success: true, oid: 'abc1234' }
      }
    } catch (err) {
      const errObj = err as { message?: string }
      const errorMessage = errObj.message || 'Commit failed'
      set({ isCommitting: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  refreshHistory: async () => {
    const { projectDir } = get()
    if (!projectDir) return

    set({ isLoadingHistory: true })

    try {
      if (window.electronAPI?.git) {
        const result = await window.electronAPI.git.log(projectDir, 20)
        if (result.error) {
          set({ commits: [], isLoadingHistory: false })
          return
        }
        set({ commits: result.commits, isLoadingHistory: false })
      } else {
        // Browser mode: demo commits
        set({
          commits: [
            {
              oid: 'abc1234def5678',
              message: 'Initial commit: phone stand model',
              author: { name: 'User', email: 'user@example.com', timestamp: Date.now() / 1000 - 3600 },
            },
            {
              oid: 'def5678abc1234',
              message: 'Add gear generator',
              author: { name: 'User', email: 'user@example.com', timestamp: Date.now() / 1000 - 7200 },
            },
          ],
          isLoadingHistory: false,
        })
      }
    } catch (err: unknown) {
      set({ commits: [], isLoadingHistory: false })
    }
  },

  initRepo: async (createInitialCommit: boolean = false) => {
    const { projectDir } = get()
    if (!projectDir) return { success: false, error: 'No project directory' }

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.init(projectDir)
      if (result.success) {
        set({ isGitRepo: true })

        // Create initial commit if requested (Feature #51)
        if (createInitialCommit) {
          // Stage all files
          const statusResult = await window.electronAPI.git.status(projectDir)
          if (!statusResult.error && statusResult.files.length > 0) {
            for (const file of statusResult.files) {
              await window.electronAPI.git.add(projectDir, file.filepath)
            }
            // Create initial commit
            const gitPrefs = useSettingsStore.getState().preferences.git ?? { authorName: 'ClawdCAD User', authorEmail: 'user@ClawdCAD.local' }
            await window.electronAPI.git.commit(projectDir, 'Initial commit', {
              name: gitPrefs.authorName,
              email: gitPrefs.authorEmail,
            })
          }
        }

        await get().refreshStatus()
        await get().refreshHistory()
        await get().refreshBranches()
      }
      return result
    }
    set({ isGitRepo: true })
    return { success: true }
  },

  // --- Discard Operations ---

  discardFile: async (filepath) => {
    const { projectDir } = get()
    if (!projectDir) return { success: false, error: 'No project directory' }

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.discard(projectDir, filepath)
      if (result.success) {
        await get().refreshStatus()
      }
      return result
    }
    return { success: false, error: 'Electron API not available' }
  },

  // --- Remote Operations (Feature #42) ---

  setRemoteUrl: (url) => set({ remoteUrl: url }),

  configureRemote: async (url) => {
    const { projectDir } = get()
    if (!projectDir) return

    set({ remoteError: null, remoteSuccess: null })

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.addRemote(projectDir, 'origin', url)
      if (result.success) {
        set({ remoteUrl: url, remoteSuccess: 'Remote configured' })
      } else {
        set({ remoteError: result.error || 'Failed to configure remote' })
      }
    } else {
      set({ remoteUrl: url, remoteSuccess: 'Remote configured (browser demo)' })
    }
    setTimeout(() => set({ remoteSuccess: null }), 3000)
  },

  push: async (token) => {
    const { projectDir } = get()
    if (!projectDir) return

    set({ isPushing: true, remoteError: null, remoteSuccess: null })

    try {
      if (window.electronAPI?.git) {
        const result = await window.electronAPI.git.push(projectDir, 'origin', undefined, token)
        if (result.success) {
          set({ isPushing: false, remoteSuccess: 'Pushed successfully' })
        } else {
          set({ isPushing: false, remoteError: result.error || 'Push failed' })
        }
      } else {
        // Browser mode: simulate
        set({ isPushing: false, remoteSuccess: 'Pushed successfully (browser demo)' })
      }
    } catch (err) {
      const errObj = err as { message?: string }
      set({ isPushing: false, remoteError: errObj.message || 'Push failed' })
    }
    setTimeout(() => set({ remoteSuccess: null }), 3000)
  },

  pull: async (token) => {
    const { projectDir } = get()
    if (!projectDir) return

    set({ isPulling: true, remoteError: null, remoteSuccess: null })

    try {
      if (window.electronAPI?.git) {
        const result = await window.electronAPI.git.pull(projectDir, 'origin', undefined, token)
        if (result.success) {
          set({ isPulling: false, remoteSuccess: 'Pulled successfully' })
          await get().refreshStatus()
          await get().refreshHistory()
        } else {
          const error = result.error || 'Pull failed'
          set({ isPulling: false, remoteError: error })
          // Refresh status after conflict so user sees conflicted files
          if (error.toLowerCase().includes('conflict')) {
            await get().refreshStatus()
          }
        }
      } else {
        set({ isPulling: false, remoteSuccess: 'Pulled successfully (browser demo)' })
      }
    } catch (err) {
      const errObj = err as { message?: string }
      set({ isPulling: false, remoteError: errObj.message || 'Pull failed' })
    }
    setTimeout(() => set({ remoteSuccess: null }), 3000)
  },

  clearRemoteMessages: () => set({ remoteError: null, remoteSuccess: null }),

  // --- Diff Operations (Feature #41) ---

  openDiff: async (filepath, isStaged) => {
    const { projectDir } = get()
    if (!projectDir) return

    let original = ''
    let modified = ''

    if (window.electronAPI?.git) {
      // Get the HEAD version as original
      const headResult = await window.electronAPI.git.getFileContent(projectDir, filepath, 'HEAD')
      original = headResult.content || ''

      // Get the working directory version as modified
      const workdirResult = await window.electronAPI.git.getFileContent(projectDir, filepath, 'WORKDIR')
      modified = workdirResult.content || ''
    } else {
      // Browser mode: demo diff
      original = '// Original version\ncube([10, 10, 10]);\n'
      modified = '// Modified version\ncube([20, 20, 20]);\nsphere(r=5);\n'
    }

    set({
      diff: {
        isOpen: true,
        filepath,
        original,
        modified,
        isStaged,
      },
    })
  },

  closeDiff: () => {
    set({
      diff: {
        isOpen: false,
        filepath: '',
        original: '',
        modified: '',
        isStaged: false,
      },
    })
  },

  // --- Branch Operations (Feature #43) ---

  refreshBranches: async () => {
    const { projectDir } = get()
    if (!projectDir) return

    set({ isLoadingBranches: true })

    try {
      if (window.electronAPI?.git) {
        const [branchResult, currentResult] = await Promise.all([
          window.electronAPI.git.listBranches(projectDir),
          window.electronAPI.git.currentBranch(projectDir),
        ])
        set({
          branches: branchResult.branches || [],
          currentBranch: currentResult.branch || null,
          isLoadingBranches: false,
        })
      } else {
        // Browser mode: demo branches
        set({
          branches: [
            { name: 'main', current: true },
            { name: 'feature/phone-stand', current: false },
            { name: 'develop', current: false },
          ],
          currentBranch: 'main',
          isLoadingBranches: false,
        })
      }
    } catch (err: unknown) {
      set({ branches: [], currentBranch: null, isLoadingBranches: false })
    }
  },

  switchBranch: async (branch) => {
    const { projectDir } = get()
    if (!projectDir) return { success: false, error: 'No project directory' }

    // Check for uncommitted changes
    if (window.electronAPI?.git) {
      const hasChanges = await window.electronAPI.git.hasUncommittedChanges(projectDir)
      if (hasChanges) {
        const confirmed = window.confirm(
          `You have uncommitted changes. Switching to branch "${branch}" may discard them. Continue?`
        )
        if (!confirmed) return { success: false, error: 'Cancelled' }
      }

      const result = await window.electronAPI.git.checkout(projectDir, branch)
      if (result.success) {
        set({ currentBranch: branch })
        await get().refreshStatus()
        await get().refreshHistory()
        await get().refreshBranches()
      }
      return result
    } else {
      set({ currentBranch: branch })
      return { success: true }
    }
  },

  createBranch: async (name) => {
    const { projectDir } = get()
    if (!projectDir) return { success: false, error: 'No project directory' }

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.createBranch(projectDir, name)
      if (result.success) {
        await get().refreshBranches()
        set({ showCreateBranch: false, newBranchName: '' })
      }
      return result
    } else {
      set({ showCreateBranch: false, newBranchName: '' })
      return { success: true }
    }
  },

  setShowCreateBranch: (show) => set({ showCreateBranch: show }),
  setNewBranchName: (name) => set({ newBranchName: name }),

  // --- File History Actions ---

  toggleCommitExpand: async (oid) => {
    const { expandedCommitOid, projectDir } = get()

    // Collapse if already expanded
    if (expandedCommitOid === oid) {
      set({ expandedCommitOid: null, commitFilesForExpanded: [], isLoadingCommitFiles: false })
      return
    }

    set({ expandedCommitOid: oid, commitFilesForExpanded: [], isLoadingCommitFiles: true })

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.commitFiles(projectDir, oid)
      if (!result.error) {
        set({ commitFilesForExpanded: result.files, isLoadingCommitFiles: false })
      } else {
        set({ isLoadingCommitFiles: false })
      }
    } else {
      // Browser demo
      set({
        commitFilesForExpanded: [
          { filepath: 'main.scad', status: 'modified' },
          { filepath: 'gear.scad', status: 'added' },
        ],
        isLoadingCommitFiles: false,
      })
    }
  },

  openFileHistory: async (filepath) => {
    const { projectDir } = get()
    set({
      fileHistory: { isOpen: true, filepath, commits: [], isLoading: true },
    })

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.fileLog(projectDir, filepath)
      if (!result.error) {
        set({
          fileHistory: { isOpen: true, filepath, commits: result.commits, isLoading: false },
        })
      } else {
        set({
          fileHistory: { isOpen: true, filepath, commits: [], isLoading: false },
        })
      }
    } else {
      // Browser demo
      set({
        fileHistory: {
          isOpen: true,
          filepath,
          commits: [
            { oid: 'abc1234', message: 'Add rounded edges', author: { name: 'User', email: 'u@e.com', timestamp: Date.now() / 1000 - 7200 } },
            { oid: 'def5678', message: 'Initial model', author: { name: 'User', email: 'u@e.com', timestamp: Date.now() / 1000 - 86400 } },
          ],
          isLoading: false,
        },
      })
    }
  },

  closeFileHistory: () => {
    set({
      fileHistory: { isOpen: false, filepath: '', commits: [], isLoading: false },
    })
  },

  openVersionPreview: async (filepath, oid, commitMessage) => {
    const { projectDir } = get()
    set({
      versionPreview: { isOpen: true, filepath, oid, commitMessage, content: '', isLoading: true },
    })

    if (window.electronAPI?.git) {
      const result = await window.electronAPI.git.getFileContent(projectDir, filepath, oid)
      set({
        versionPreview: {
          isOpen: true,
          filepath,
          oid,
          commitMessage,
          content: result.content || '',
          isLoading: false,
        },
      })
    } else {
      // Browser demo
      set({
        versionPreview: {
          isOpen: true,
          filepath,
          oid,
          commitMessage,
          content: '// Historical version\ncube([10, 10, 10]);\n',
          isLoading: false,
        },
      })
    }
  },

  closeVersionPreview: () => {
    set({
      versionPreview: { isOpen: false, filepath: '', oid: '', commitMessage: '', content: '', isLoading: false },
    })
  },
}))
