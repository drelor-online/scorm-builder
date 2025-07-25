import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiKeyStorage, apiKeyStorage } from '../ApiKeyStorage'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

global.localStorage = localStorageMock as any

// Mock console methods
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('ApiKeyStorage', () => {
  let storage: ApiKeyStorage

  beforeEach(() => {
    vi.clearAllMocks()
    // Get singleton instance
    storage = ApiKeyStorage.getInstance()
    // Clear cached keys
    ;(storage as any).cachedKeys = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ApiKeyStorage.getInstance()
      const instance2 = ApiKeyStorage.getInstance()
      
      expect(instance1).toBe(instance2)
    })

    it('should use the exported singleton', () => {
      expect(apiKeyStorage).toBe(ApiKeyStorage.getInstance())
    })
  })

  describe('Save API Keys', () => {
    it('should save API keys successfully', async () => {
      const apiKeys = {
        googleImageApiKey: 'google-key-123',
        googleCseId: 'cse-id-123',
        youtubeApiKey: 'youtube-key-123'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)

      await storage.save(apiKeys)

      expect(invoke).toHaveBeenCalledWith('save_api_keys', {
        apiKeys: {
          google_image_api_key: 'google-key-123',
          google_cse_id: 'cse-id-123',
          youtube_api_key: 'youtube-key-123'
        }
      })
      
      expect(storage.getCached()).toEqual(apiKeys)
      expect(consoleLogSpy).toHaveBeenCalledWith('API keys saved successfully to encrypted file')
    })

    it('should handle save errors', async () => {
      const apiKeys = {
        googleImageApiKey: 'key',
        googleCseId: 'id',
        youtubeApiKey: 'key'
      }

      const error = new Error('Failed to encrypt')
      ;(invoke as any).mockRejectedValueOnce(error)

      await expect(storage.save(apiKeys)).rejects.toThrow('Failed to save API keys: Error: Failed to encrypt')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save API keys:', error)
    })
  })

  describe('Load API Keys', () => {
    it('should load API keys successfully', async () => {
      const backendKeys = {
        google_image_api_key: 'google-key-123',
        google_cse_id: 'cse-id-123',
        youtube_api_key: 'youtube-key-123'
      }

      ;(invoke as any).mockResolvedValueOnce(backendKeys)

      const result = await storage.load()

      expect(invoke).toHaveBeenCalledWith('load_api_keys')
      expect(result).toEqual({
        googleImageApiKey: 'google-key-123',
        googleCseId: 'cse-id-123',
        youtubeApiKey: 'youtube-key-123'
      })
      expect(storage.getCached()).toEqual(result)
      expect(consoleLogSpy).toHaveBeenCalledWith('API keys loaded successfully from encrypted file')
    })

    it('should fall back to localStorage when file not found', async () => {
      const error = new Error('File not found')
      ;(invoke as any).mockRejectedValueOnce(error)

      const storedKeys = {
        googleImageApiKey: 'stored-google-key',
        googleCseId: 'stored-cse-id',
        youtubeApiKey: 'stored-youtube-key'
      }
      
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedKeys))
      ;(invoke as any).mockResolvedValueOnce(undefined) // For the save call

      const result = await storage.load()

      expect(result).toEqual(storedKeys)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('scorm_builder_api_keys')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('scorm_builder_api_keys')
      expect(consoleLogSpy).toHaveBeenCalledWith('Migrating API keys from localStorage to encrypted file')
    })

    it('should return null when no keys found anywhere', async () => {
      const error = new Error('File not found')
      ;(invoke as any).mockRejectedValueOnce(error)
      localStorageMock.getItem.mockReturnValueOnce(null)

      const result = await storage.load()

      expect(result).toBeNull()
    })

    it('should log non-"not found" errors', async () => {
      const error = new Error('Decryption failed')
      ;(invoke as any).mockRejectedValueOnce(error)
      localStorageMock.getItem.mockReturnValueOnce(null)

      await storage.load()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load API keys:', error)
    })

    it('should handle localStorage migration errors gracefully', async () => {
      const error = new Error('File not found')
      ;(invoke as any).mockRejectedValueOnce(error)
      localStorageMock.getItem.mockReturnValueOnce('invalid json')

      const result = await storage.load()

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to migrate from localStorage:', expect.any(Error))
    })
  })

  describe('Delete API Keys', () => {
    it('should delete API keys successfully', async () => {
      // First cache some keys
      ;(storage as any).cachedKeys = {
        googleImageApiKey: 'key',
        googleCseId: 'id',
        youtubeApiKey: 'key'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)

      await storage.delete()

      expect(invoke).toHaveBeenCalledWith('delete_api_keys')
      expect(storage.getCached()).toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('API keys deleted successfully')
    })

    it('should handle delete errors', async () => {
      const error = new Error('Permission denied')
      ;(invoke as any).mockRejectedValueOnce(error)

      await expect(storage.delete()).rejects.toThrow('Failed to delete API keys: Error: Permission denied')
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete API keys:', error)
    })
  })

  describe('Cache Management', () => {
    it('should return null when no keys cached', () => {
      expect(storage.getCached()).toBeNull()
    })

    it('should return cached keys after save', async () => {
      const apiKeys = {
        googleImageApiKey: 'key1',
        googleCseId: 'id1',
        youtubeApiKey: 'key2'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)
      await storage.save(apiKeys)

      expect(storage.getCached()).toEqual(apiKeys)
    })

    it('should return cached keys after load', async () => {
      const backendKeys = {
        google_image_api_key: 'key1',
        google_cse_id: 'id1',
        youtube_api_key: 'key2'
      }

      ;(invoke as any).mockResolvedValueOnce(backendKeys)
      await storage.load()

      expect(storage.getCached()).toEqual({
        googleImageApiKey: 'key1',
        googleCseId: 'id1',
        youtubeApiKey: 'key2'
      })
    })

    it('should clear cache after delete', async () => {
      // Set some cached keys
      ;(storage as any).cachedKeys = {
        googleImageApiKey: 'key',
        googleCseId: 'id',
        youtubeApiKey: 'key'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)
      await storage.delete()

      expect(storage.getCached()).toBeNull()
    })
  })

  describe('Case Conversion', () => {
    it('should convert camelCase to snake_case when saving', async () => {
      const apiKeys = {
        googleImageApiKey: 'gKey',
        googleCseId: 'cseId',
        youtubeApiKey: 'yKey'
      }

      ;(invoke as any).mockResolvedValueOnce(undefined)
      await storage.save(apiKeys)

      expect(invoke).toHaveBeenCalledWith('save_api_keys', {
        apiKeys: {
          google_image_api_key: 'gKey',
          google_cse_id: 'cseId',
          youtube_api_key: 'yKey'
        }
      })
    })

    it('should convert snake_case to camelCase when loading', async () => {
      const backendKeys = {
        google_image_api_key: 'gKey',
        google_cse_id: 'cseId',
        youtube_api_key: 'yKey'
      }

      ;(invoke as any).mockResolvedValueOnce(backendKeys)
      const result = await storage.load()

      expect(result).toEqual({
        googleImageApiKey: 'gKey',
        googleCseId: 'cseId',
        youtubeApiKey: 'yKey'
      })
    })
  })

  describe('Migration from localStorage', () => {
    it('should migrate and save to encrypted storage', async () => {
      const error = new Error('File not found')
      ;(invoke as any).mockRejectedValueOnce(error) // load fails

      const storedKeys = {
        googleImageApiKey: 'old-google-key',
        googleCseId: 'old-cse-id',
        youtubeApiKey: 'old-youtube-key'
      }
      
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedKeys))
      ;(invoke as any).mockResolvedValueOnce(undefined) // save succeeds

      const result = await storage.load()

      expect(result).toEqual(storedKeys)
      
      // Should attempt to save to encrypted storage
      expect(invoke).toHaveBeenCalledWith('save_api_keys', {
        apiKeys: {
          google_image_api_key: 'old-google-key',
          google_cse_id: 'old-cse-id',
          youtube_api_key: 'old-youtube-key'
        }
      })
      
      // Should remove from localStorage
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('scorm_builder_api_keys')
    })

    it('should handle migration save errors gracefully', async () => {
      const loadError = new Error('File not found')
      ;(invoke as any).mockRejectedValueOnce(loadError) // load fails

      const storedKeys = {
        googleImageApiKey: 'key',
        googleCseId: 'id',
        youtubeApiKey: 'key'
      }
      
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedKeys))
      
      const saveError = new Error('Save failed')
      ;(invoke as any).mockRejectedValueOnce(saveError) // save fails

      const result = await storage.load()

      // Should still return the keys even if save fails
      expect(result).toEqual(storedKeys)
      expect(consoleErrorSpy).toHaveBeenCalledWith(saveError)
    })
  })
})