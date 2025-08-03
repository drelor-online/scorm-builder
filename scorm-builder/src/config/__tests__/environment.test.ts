import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEnvironmentConfig, validateEnvironmentConfig, EnvironmentConfig } from '../environment'

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Reset environment variables
    vi.resetModules()
    vi.stubEnv('VITE_API_ENDPOINT', '')
    vi.stubEnv('VITE_GOOGLE_IMAGE_API_KEY', '')
    vi.stubEnv('VITE_GOOGLE_CSE_ID', '')
    vi.stubEnv('VITE_YOUTUBE_API_KEY', '')
    vi.stubEnv('MODE', 'development')
  })

  describe('getEnvironmentConfig', () => {
    it('should return default values when environment variables are not set', () => {
      const config = getEnvironmentConfig()
      
      expect(config.apiEndpoint).toBe('')
      expect(config.googleImageApiKey).toBe('')
      expect(config.googleCseId).toBe('')
      expect(config.youtubeApiKey).toBe('')
      expect(config.isDevelopment).toBe(true)
      expect(config.isProduction).toBe(false)
    })

    it('should return environment variable values when set', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.example.com')
      vi.stubEnv('VITE_GOOGLE_IMAGE_API_KEY', 'test-image-key')
      vi.stubEnv('VITE_GOOGLE_CSE_ID', 'test-cse-id')
      vi.stubEnv('VITE_YOUTUBE_API_KEY', 'test-youtube-key')
      
      const config = getEnvironmentConfig()
      
      expect(config.apiEndpoint).toBe('https://api.example.com')
      expect(config.googleImageApiKey).toBe('test-image-key')
      expect(config.googleCseId).toBe('test-cse-id')
      expect(config.youtubeApiKey).toBe('test-youtube-key')
    })

    it('should detect production environment', () => {
      vi.stubEnv('MODE', 'production')
      const config = getEnvironmentConfig()
      
      expect(config.isDevelopment).toBe(false)
      expect(config.isProduction).toBe(true)
    })
  })

  describe('validateEnvironmentConfig', () => {
    it('should return valid for complete configuration', () => {
      const config: EnvironmentConfig = {
        apiEndpoint: 'https://api.example.com',
        googleImageApiKey: 'key1',
        googleCseId: 'id1',
        youtubeApiKey: 'key2',
        isDevelopment: false,
        isProduction: true,
        isTest: false
      }
      
      const result = validateEnvironmentConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.missingKeys).toHaveLength(0)
    })

    it('should return missing keys for incomplete configuration', () => {
      const config: EnvironmentConfig = {
        apiEndpoint: '',
        googleImageApiKey: '',
        googleCseId: 'id1',
        youtubeApiKey: '',
        isDevelopment: false,
        isProduction: true,
        isTest: false
      }
      
      const result = validateEnvironmentConfig(config)
      expect(result.isValid).toBe(false)
      expect(result.missingKeys).toContain('googleImageApiKey')
      expect(result.missingKeys).toContain('youtubeApiKey')
      expect(result.missingKeys).not.toContain('googleCseId')
    })

    it('should not require API keys in development mode', () => {
      const config: EnvironmentConfig = {
        apiEndpoint: '',
        googleImageApiKey: '',
        googleCseId: '',
        youtubeApiKey: '',
        isDevelopment: true,
        isProduction: false,
        isTest: false
      }
      
      const result = validateEnvironmentConfig(config)
      expect(result.isValid).toBe(true)
      expect(result.missingKeys).toHaveLength(0)
    })
  })
})