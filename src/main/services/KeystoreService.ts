import { safeStorage } from 'electron'
import { preferencesService } from './PreferencesService'

class KeystoreService {

  setApiKey(apiKey: string): boolean {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('KeystoreService: OS encryption not available')
      return false
    }

    const encrypted = safeStorage.encryptString(apiKey)
    const base64 = encrypted.toString('base64')
    preferencesService.set('encrypted_api_key', base64)
    return true
  }

  hasApiKey(): boolean {
    const stored = preferencesService.get('encrypted_api_key')
    return typeof stored === 'string' && stored.length > 0
  }

  getDecryptedKey(): string | null {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('KeystoreService: OS encryption not available')
      return null
    }

    const base64 = preferencesService.get('encrypted_api_key') as string | undefined
    if (!base64) return null

    try {
      const encrypted = Buffer.from(base64, 'base64')
      return safeStorage.decryptString(encrypted)
    } catch (err) {
      console.error('KeystoreService: Failed to decrypt API key', err)
      return null
    }
  }

  deleteApiKey(): boolean {
    preferencesService.set('encrypted_api_key', '')
    return true
  }
}

export const keystoreService = new KeystoreService()
