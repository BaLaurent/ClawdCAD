/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// Mock chokidar before importing FileService
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      close: vi.fn(),
    }),
  },
}))

// We need to import after mocks
import { fileService } from '../FileService'

describe('FileService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('validatePath', () => {
    it('should accept valid absolute path', () => {
      expect(fileService.validatePath('/home/user/project/file.ts')).toBe(true)
    })

    it('should reject traversal with basePath', () => {
      expect(fileService.validatePath('/home/user/../etc/passwd', '/home/user')).toBe(false)
    })

    it('should accept path within basePath', () => {
      expect(fileService.validatePath('/home/user/project/src/file.ts', '/home/user/project')).toBe(true)
    })

    it('should reject pure traversal patterns', () => {
      expect(fileService.validatePath('../../etc/passwd')).toBe(false)
    })
  })

  describe('readFile', () => {
    it('should read file successfully', async () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue('file content')
      const result = await fileService.readFile('/test/file.txt')
      expect(result.content).toBe('file content')
      expect(result.error).toBeUndefined()
    })

    it('should return error when file not found', async () => {
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('ENOENT') })
      const result = await fileService.readFile('/nonexistent')
      expect(result.content).toBe('')
      expect(result.error).toContain('Failed to read file')
    })
  })

  describe('saveFile', () => {
    it('should save file and create parent dirs', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
      const result = await fileService.saveFile('/test/dir/file.txt', 'content')
      expect(result.success).toBe(true)
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname('/test/dir/file.txt'), { recursive: true })
    })

    it('should return error on write failure', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('EACCES') })
      const result = await fileService.saveFile('/readonly/file.txt', 'content')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to save file')
    })
  })

  describe('createFile', () => {
    it('should fail if file already exists', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      const result = await fileService.createFile('/existing/file.txt')
      expect(result.success).toBe(false)
      expect(result.error).toBe('File already exists')
    })

    it('should create file with content', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(false).mockReturnValueOnce(false)
      vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
      const result = await fileService.createFile('/new/file.txt', 'hello')
      expect(result.success).toBe(true)
      expect(fs.writeFileSync).toHaveBeenCalledWith('/new/file.txt', 'hello', 'utf-8')
    })
  })

  describe('deleteFile', () => {
    it('should fail if file does not exist', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      const result = await fileService.deleteFile('/nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toBe('File does not exist')
    })

    it('should delete a regular file', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false } as any)
      vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)
      const result = await fileService.deleteFile('/test/file.txt')
      expect(result.success).toBe(true)
    })

    it('should delete a directory recursively', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any)
      vi.spyOn(fs, 'rmSync').mockReturnValue(undefined)
      const result = await fileService.deleteFile('/test/dir')
      expect(result.success).toBe(true)
      expect(fs.rmSync).toHaveBeenCalledWith('/test/dir', { recursive: true })
    })
  })

  describe('renameFile', () => {
    it('should fail if source does not exist', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      const result = await fileService.renameFile('/old', '/new')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Source file does not exist')
    })

    it('should fail if destination already exists', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true).mockReturnValueOnce(true)
      const result = await fileService.renameFile('/old', '/new')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Destination already exists')
    })

    it('should rename successfully', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true).mockReturnValueOnce(false)
      vi.spyOn(fs, 'renameSync').mockReturnValue(undefined)
      const result = await fileService.renameFile('/old', '/new')
      expect(result.success).toBe(true)
    })
  })

  describe('listDirectory', () => {
    it('should return error for non-existent directory', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      const result = await fileService.listDirectory('/nonexistent')
      expect(result.files).toEqual([])
      expect(result.error).toBe('Directory does not exist')
    })
  })
})
