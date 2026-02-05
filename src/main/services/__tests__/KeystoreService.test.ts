import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockReturnValue(Buffer.from('encrypted-data')),
    decryptString: vi.fn().mockReturnValue('sk-ant-test-key'),
  },
}))

// Mock PreferencesService
const mockGet = vi.fn()
const mockSet = vi.fn()

vi.mock('../PreferencesService', () => ({
  preferencesService: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}))

import { safeStorage } from 'electron'
import { keystoreService } from '../KeystoreService'

describe('KeystoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
  })

  describe('setApiKey', () => {
    it('should encrypt and store the key', () => {
      const result = keystoreService.setApiKey('sk-ant-test')
      expect(result).toBe(true)
      expect(safeStorage.encryptString).toHaveBeenCalledWith('sk-ant-test')
      expect(mockSet).toHaveBeenCalledWith('encrypted_api_key', expect.any(String))
    })

    it('should return false when encryption unavailable', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      const result = keystoreService.setApiKey('sk-ant-test')
      expect(result).toBe(false)
    })
  })

  describe('hasApiKey', () => {
    it('should return true when key exists', () => {
      mockGet.mockReturnValue('some-base64-data')
      expect(keystoreService.hasApiKey()).toBe(true)
    })

    it('should return false when no key', () => {
      mockGet.mockReturnValue(undefined)
      expect(keystoreService.hasApiKey()).toBe(false)
    })

    it('should return false for empty string', () => {
      mockGet.mockReturnValue('')
      expect(keystoreService.hasApiKey()).toBe(false)
    })
  })

  describe('getDecryptedKey', () => {
    it('should decrypt and return the key', () => {
      mockGet.mockReturnValue(Buffer.from('encrypted-data').toString('base64'))
      const result = keystoreService.getDecryptedKey()
      expect(result).toBe('sk-ant-test-key')
    })

    it('should return null when no key stored', () => {
      mockGet.mockReturnValue(undefined)
      expect(keystoreService.getDecryptedKey()).toBeNull()
    })

    it('should return null when encryption unavailable', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      expect(keystoreService.getDecryptedKey()).toBeNull()
    })
  })

  describe('deleteApiKey', () => {
    it('should set empty string', () => {
      expect(keystoreService.deleteApiKey()).toBe(true)
      expect(mockSet).toHaveBeenCalledWith('encrypted_api_key', '')
    })
  })
})
