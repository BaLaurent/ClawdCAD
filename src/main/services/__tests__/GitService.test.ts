/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import git from 'isomorphic-git'
import fs from 'fs'

vi.mock('isomorphic-git')
vi.mock('isomorphic-git/http/node', () => ({ default: {} }))

import { gitService } from '../GitService'

describe('GitService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('init', () => {
    it('should reject non-existent directory', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      const result = await gitService.init('/nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Directory does not exist')
    })

    it('should reject non-directory path', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false } as any)
      const result = await gitService.init('/some/file.txt')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Path is not a directory')
    })

    it('should reject root directory', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      const result = await gitService.init('/')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot use root directory')
    })

    it('should init successfully', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      vi.mocked(git.init).mockResolvedValue(undefined as any)
      const result = await gitService.init('/home/user/project')
      expect(result.success).toBe(true)
      expect(git.init).toHaveBeenCalledWith({ fs, dir: '/home/user/project' })
    })
  })

  describe('status', () => {
    it('should return error for non-git repo', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      vi.mocked(git.statusMatrix).mockRejectedValue({ code: 'NotFoundError', message: 'not a git repo' })
      const result = await gitService.status('/home/user/project')
      expect(result.error).toBe('Not a git repository')
    })

    it('should parse status matrix correctly', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      vi.mocked(git.statusMatrix).mockResolvedValue([
        ['new-file.ts', 0, 2, 0],       // untracked
        ['modified.ts', 1, 2, 1],        // modified, unstaged
        ['staged.ts', 0, 2, 2],          // added, staged
        ['unchanged.ts', 1, 1, 1],       // unmodified (should be filtered)
      ] as any)
      const result = await gitService.status('/home/user/project')
      expect(result.files).toHaveLength(3)
      expect(result.files[0]).toEqual({ filepath: 'new-file.ts', status: 'untracked', staged: false })
      expect(result.files[1]).toEqual({ filepath: 'modified.ts', status: 'modified', staged: false })
      expect(result.files[2]).toEqual({ filepath: 'staged.ts', status: 'added', staged: true })
    })
  })

  describe('commit', () => {
    it('should commit successfully', async () => {
      vi.mocked(git.commit).mockResolvedValue('abc123')
      const result = await gitService.commit('/project', 'Initial commit', { name: 'Test', email: 'test@test.com' })
      expect(result.success).toBe(true)
      expect(result.oid).toBe('abc123')
    })

    it('should return error on failure', async () => {
      vi.mocked(git.commit).mockRejectedValue(new Error('nothing to commit'))
      const result = await gitService.commit('/project', 'msg', { name: 'Test', email: 'test@test.com' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('nothing to commit')
    })
  })

  describe('clone', () => {
    it('should reject non-HTTPS URLs', async () => {
      const result = await gitService.clone('git@github.com:user/repo.git', '/target')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Only HTTPS remotes are supported')
    })

    it('should clone HTTPS repo', async () => {
      vi.mocked(git.clone).mockResolvedValue(undefined as any)
      const result = await gitService.clone('https://github.com/user/repo.git', '/target')
      expect(result.success).toBe(true)
    })
  })

  describe('branch operations', () => {
    it('should get current branch', async () => {
      vi.mocked(git.currentBranch).mockResolvedValue('main')
      const result = await gitService.currentBranch('/project')
      expect(result.branch).toBe('main')
    })

    it('should list branches', async () => {
      vi.mocked(git.listBranches).mockResolvedValue(['main', 'develop'])
      vi.mocked(git.currentBranch).mockResolvedValue('main')
      const result = await gitService.listBranches('/project')
      expect(result.branches).toHaveLength(2)
      expect(result.branches[0]).toEqual({ name: 'main', current: true })
      expect(result.branches[1]).toEqual({ name: 'develop', current: false })
    })

    it('should create branch', async () => {
      vi.mocked(git.branch).mockResolvedValue(undefined as any)
      const result = await gitService.createBranch('/project', 'feature')
      expect(result.success).toBe(true)
    })
  })

  describe('push', () => {
    it('should return error when currentBranch is null (detached HEAD)', async () => {
      vi.mocked(git.currentBranch).mockResolvedValue(undefined as any)
      const result = await gitService.push('/project')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot determine current branch. Detached HEAD?')
    })

    it('should push successfully with valid branch', async () => {
      vi.mocked(git.currentBranch).mockResolvedValue('main')
      vi.mocked(git.push).mockResolvedValue(undefined as any)
      const result = await gitService.push('/project')
      expect(result.success).toBe(true)
    })
  })

  describe('pull', () => {
    it('should return error when currentBranch is null (detached HEAD)', async () => {
      vi.mocked(git.currentBranch).mockResolvedValue(undefined as any)
      const result = await gitService.pull('/project')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot determine current branch. Detached HEAD?')
    })

    it('should detect merge conflicts', async () => {
      vi.mocked(git.currentBranch).mockResolvedValue('main')
      vi.mocked(git.pull).mockRejectedValue(new Error('MergeConflict: conflict in file.ts'))
      const result = await gitService.pull('/project')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Merge conflict detected. Please resolve conflicts manually.')
    })
  })

  describe('getFileContent', () => {
    it('should reject path traversal attempts', async () => {
      const result = await gitService.getFileContent('/project', '../../../etc/passwd', 'WORKDIR')
      expect(result.content).toBe('')
      expect(result.error).toBe('Path traversal detected')
    })

    it('should read from WORKDIR with path.join', async () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue('file content')
      const result = await gitService.getFileContent('/project', 'src/main.ts', 'WORKDIR')
      expect(result.content).toBe('file content')
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('src/main.ts'),
        'utf8'
      )
    })
  })

  describe('discardFile', () => {
    it('should reject path traversal attempts', async () => {
      const result = await gitService.discardFile('/project', '../../../etc/passwd')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Path traversal detected')
    })

    it('should discard file successfully', async () => {
      vi.mocked(git.checkout).mockResolvedValue(undefined as any)
      const result = await gitService.discardFile('/project', 'src/main.ts')
      expect(result.success).toBe(true)
      expect(git.checkout).toHaveBeenCalledWith({
        fs,
        dir: '/project',
        filepaths: ['src/main.ts'],
      })
    })

    it('should return error on failure', async () => {
      vi.mocked(git.checkout).mockRejectedValue(new Error('file not found'))
      const result = await gitService.discardFile('/project', 'missing.ts')
      expect(result.success).toBe(false)
      expect(result.error).toBe('file not found')
    })
  })

  describe('fileLog', () => {
    it('should reject path traversal attempts', async () => {
      const result = await gitService.fileLog('/project', '../../../etc/passwd')
      expect(result.commits).toEqual([])
      expect(result.error).toBe('Path traversal detected')
    })

    it('should return file-specific commits', async () => {
      vi.mocked(git.log).mockResolvedValue([
        {
          oid: 'abc123',
          commit: {
            message: 'Edit main.scad',
            parent: ['parent1'],
            tree: 'tree1',
            author: { name: 'User', email: 'u@e.com', timestamp: 1000, timezoneOffset: 0 },
            committer: { name: 'User', email: 'u@e.com', timestamp: 1000, timezoneOffset: 0 },
          },
          payload: '',
        },
      ] as any)
      const result = await gitService.fileLog('/project', 'main.scad')
      expect(result.commits).toHaveLength(1)
      expect(result.commits[0].oid).toBe('abc123')
      expect(result.commits[0].message).toBe('Edit main.scad')
      expect(git.log).toHaveBeenCalledWith(expect.objectContaining({ filepath: 'main.scad', depth: 50 }))
    })

    it('should return empty array on error', async () => {
      vi.mocked(git.log).mockRejectedValue(new Error('something went wrong'))
      const result = await gitService.fileLog('/project', 'nonexistent.scad')
      expect(result.commits).toEqual([])
      expect(result.error).toBe('something went wrong')
    })
  })

  describe('getCommitFiles', () => {
    it('should detect added/modified/deleted files between parent and commit', async () => {
      // Mock readCommit to return a commit with one parent
      vi.mocked(git.readCommit).mockResolvedValue({
        oid: 'child',
        commit: {
          message: 'some change',
          parent: ['parent1'],
          tree: 'tree2',
          author: { name: 'U', email: 'e', timestamp: 100, timezoneOffset: 0 },
          committer: { name: 'U', email: 'e', timestamp: 100, timezoneOffset: 0 },
        },
        payload: '',
      } as any)

      // Mock walk: first call for parent, second call for commit
      let walkCallCount = 0
      vi.mocked(git.walk).mockImplementation(async (opts: any) => {
        walkCallCount++
        const mapFn = opts.map

        if (walkCallCount === 1) {
          // Parent tree: has file-a and file-b
          await mapFn('file-a.scad', [{ type: async () => 'blob', oid: async () => 'blob-a-v1' }])
          await mapFn('file-b.scad', [{ type: async () => 'blob', oid: async () => 'blob-b-v1' }])
          await mapFn('.', [{ type: async () => 'tree', oid: async () => 'skip' }])
        } else {
          // Current tree: file-a modified, file-b deleted, file-c added
          await mapFn('file-a.scad', [{ type: async () => 'blob', oid: async () => 'blob-a-v2' }])
          await mapFn('file-c.scad', [{ type: async () => 'blob', oid: async () => 'blob-c-v1' }])
          await mapFn('.', [{ type: async () => 'tree', oid: async () => 'skip' }])
        }

        return undefined as any
      })

      const result = await gitService.getCommitFiles('/project', 'child')
      expect(result.error).toBeUndefined()
      expect(result.files).toHaveLength(3)

      const byPath = new Map(result.files.map(f => [f.filepath, f.status]))
      expect(byPath.get('file-a.scad')).toBe('modified')
      expect(byPath.get('file-b.scad')).toBe('deleted')
      expect(byPath.get('file-c.scad')).toBe('added')
    })

    it('should treat all files as added for root commit (no parents)', async () => {
      vi.mocked(git.readCommit).mockResolvedValue({
        oid: 'root',
        commit: {
          message: 'initial',
          parent: [],
          tree: 'tree1',
          author: { name: 'U', email: 'e', timestamp: 100, timezoneOffset: 0 },
          committer: { name: 'U', email: 'e', timestamp: 100, timezoneOffset: 0 },
        },
        payload: '',
      } as any)

      vi.mocked(git.walk).mockImplementation(async (opts: any) => {
        const mapFn = opts.map
        await mapFn('main.scad', [{ type: async () => 'blob', oid: async () => 'blob1' }])
        await mapFn('.', [{ type: async () => 'tree', oid: async () => 'skip' }])
        return undefined as any
      })

      const result = await gitService.getCommitFiles('/project', 'root')
      expect(result.files).toHaveLength(1)
      expect(result.files[0]).toEqual({ filepath: 'main.scad', status: 'added' })
    })

    it('should return error on failure', async () => {
      vi.mocked(git.readCommit).mockRejectedValue(new Error('not found'))
      const result = await gitService.getCommitFiles('/project', 'badoid')
      expect(result.files).toEqual([])
      expect(result.error).toBe('not found')
    })
  })

  describe('hasUncommittedChanges', () => {
    it('should return true when files changed', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      vi.mocked(git.statusMatrix).mockResolvedValue([
        ['file.ts', 1, 2, 1],
      ] as any)
      const result = await gitService.hasUncommittedChanges('/project')
      expect(result).toBe(true)
    })

    it('should return false when clean', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      vi.mocked(git.statusMatrix).mockResolvedValue([
        ['file.ts', 1, 1, 1],
      ] as any)
      const result = await gitService.hasUncommittedChanges('/project')
      expect(result).toBe(false)
    })
  })
})
