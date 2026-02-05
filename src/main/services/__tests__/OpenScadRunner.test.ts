/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock electron before imports
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/app',
  },
}))

// Mock PreferencesService
vi.mock('../PreferencesService', () => ({
  preferencesService: {
    get: vi.fn().mockReturnValue({ timeout: 30000 }),
  },
}))

// Mock child_process
const mockChildProcess = () => {
  const child = new EventEmitter() as any
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  return child
}

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'child_process'
import fs from 'fs'
import { openScadRunner } from '../OpenScadRunner'

describe('OpenScadRunner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('compile', () => {
    it('should return success with STL buffer and OFF data on exit code 0', async () => {
      const stlChild = mockChildProcess()
      const offChild = mockChildProcess()
      vi.mocked(spawn)
        .mockReturnValueOnce(stlChild as any)
        .mockReturnValueOnce(offChild as any)
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
      const stlContent = Buffer.from('solid test')
      const offContent = 'OFF\n4 1 0\n0 0 0\n1 0 0\n1 1 0\n0 1 0\n4 0 1 2 3 255 0 0\n'
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        if (String(p).endsWith('.off')) return offContent as any
        return stlContent
      })
      vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)

      const promise = openScadRunner.compile('cube([10, 10, 10]);')

      // Simulate successful compilation for both STL and OFF
      process.nextTick(() => {
        stlChild.emit('close', 0)
        offChild.emit('close', 0)
      })

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.stlBuffer).toBeTruthy()
      expect(result.offData).toBe(offContent)
    })

    it('should return STL success even when OFF fails', async () => {
      const stlChild = mockChildProcess()
      const offChild = mockChildProcess()
      vi.mocked(spawn)
        .mockReturnValueOnce(stlChild as any)
        .mockReturnValueOnce(offChild as any)
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        if (String(p).endsWith('.off')) return false
        return true
      })
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
      const stlContent = Buffer.from('solid test')
      vi.spyOn(fs, 'readFileSync').mockReturnValue(stlContent)
      vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)

      const promise = openScadRunner.compile('cube([10, 10, 10]);')

      process.nextTick(() => {
        stlChild.emit('close', 0)
        offChild.emit('close', 1)
      })

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.stlBuffer).toBeTruthy()
      expect(result.offData).toBeNull()
    })

    it('should return failure on non-zero exit code', async () => {
      const stlChild = mockChildProcess()
      const offChild = mockChildProcess()
      vi.mocked(spawn)
        .mockReturnValueOnce(stlChild as any)
        .mockReturnValueOnce(offChild as any)
      vi.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
        if (String(p).endsWith('.stl')) return false
        if (String(p).endsWith('.off')) return false
        return true
      })
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
      vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)

      const promise = openScadRunner.compile('invalid code')

      process.nextTick(() => {
        stlChild.stderr.emit('data', Buffer.from('ERROR: syntax error'))
        stlChild.emit('close', 1)
        offChild.emit('close', 1)
      })

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.stlBuffer).toBeNull()
      expect(result.offData).toBeNull()
      expect(result.stderr).toContain('ERROR: syntax error')
    })

    it('should handle spawn error', async () => {
      const stlChild = mockChildProcess()
      const offChild = mockChildProcess()
      vi.mocked(spawn)
        .mockReturnValueOnce(stlChild as any)
        .mockReturnValueOnce(offChild as any)
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined)
      vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)

      const promise = openScadRunner.compile('cube(10);')

      process.nextTick(() => {
        stlChild.emit('error', new Error('ENOENT'))
        offChild.emit('error', new Error('ENOENT'))
      })

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.stlBuffer).toBeNull()
      expect(result.offData).toBeNull()
      expect(result.stderr).toContain('Failed to spawn OpenSCAD')
    })
  })

  describe('checkBinary', () => {
    it('should return version on success', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      const child = mockChildProcess()
      vi.mocked(spawn).mockReturnValue(child as any)

      const promise = openScadRunner.checkBinary()

      process.nextTick(() => {
        child.stdout.emit('data', Buffer.from('OpenSCAD version 2021.01'))
        child.emit('close', 0)
      })

      const result = await promise
      expect(result.exists).toBe(true)
      expect(result.version).toBe('2021.01')
    })

    it('should return false on spawn error', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      const child = mockChildProcess()
      vi.mocked(spawn).mockReturnValue(child as any)

      const promise = openScadRunner.checkBinary()

      process.nextTick(() => {
        child.emit('error', new Error('ENOENT'))
      })

      const result = await promise
      expect(result.exists).toBe(false)
    })
  })
})
