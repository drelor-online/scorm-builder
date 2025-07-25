import { invoke } from '@tauri-apps/api/core'

export interface ApiKeys {
  googleImageApiKey: string
  googleCseId: string  
  youtubeApiKey: string
}

// Convert between camelCase (frontend) and snake_case (backend)
const toSnakeCase = (apiKeys: ApiKeys): any => ({
  google_image_api_key: apiKeys.googleImageApiKey,
  google_cse_id: apiKeys.googleCseId,
  youtube_api_key: apiKeys.youtubeApiKey
})

const toCamelCase = (apiKeys: any): ApiKeys => ({
  googleImageApiKey: apiKeys.google_image_api_key,
  googleCseId: apiKeys.google_cse_id,
  youtubeApiKey: apiKeys.youtube_api_key
})

export class ApiKeyStorage {
  private static instance: ApiKeyStorage
  private cachedKeys: ApiKeys | null = null

  private constructor() {}

  static getInstance(): ApiKeyStorage {
    if (!ApiKeyStorage.instance) {
      ApiKeyStorage.instance = new ApiKeyStorage()
    }
    return ApiKeyStorage.instance
  }

  async save(apiKeys: ApiKeys): Promise<void> {
    try {
      await invoke('save_api_keys', { apiKeys: toSnakeCase(apiKeys) })
      this.cachedKeys = apiKeys
      console.log('API keys saved successfully to encrypted file')
    } catch (error) {
      console.error('Failed to save API keys:', error)
      throw new Error(`Failed to save API keys: ${error}`)
    }
  }

  async load(): Promise<ApiKeys | null> {
    try {
      const result = await invoke<any>('load_api_keys')
      const apiKeys = toCamelCase(result)
      this.cachedKeys = apiKeys
      console.log('API keys loaded successfully from encrypted file')
      return apiKeys
    } catch (error: any) {
      // Don't log error if it's just "file not found" - this is expected for new users
      if (!error.toString().includes('not found')) {
        console.error('Failed to load API keys:', error)
      }
      // Try to load from localStorage as fallback for migration
      return this.loadFromLocalStorage()
    }
  }

  async delete(): Promise<void> {
    try {
      await invoke('delete_api_keys')
      this.cachedKeys = null
      console.log('API keys deleted successfully')
    } catch (error) {
      console.error('Failed to delete API keys:', error)
      throw new Error(`Failed to delete API keys: ${error}`)
    }
  }

  getCached(): ApiKeys | null {
    return this.cachedKeys
  }

  // Migration helper - load from localStorage if available
  private loadFromLocalStorage(): ApiKeys | null {
    try {
      const stored = localStorage.getItem('scorm_builder_api_keys')
      if (stored) {
        const apiKeys = JSON.parse(stored)
        console.log('Migrating API keys from localStorage to encrypted file')
        // Save to encrypted file for future use
        this.save(apiKeys).catch(console.error)
        // Clear localStorage after migration
        localStorage.removeItem('scorm_builder_api_keys')
        return apiKeys
      }
    } catch (error) {
      console.error('Failed to migrate from localStorage:', error)
    }
    return null
  }
}

export const apiKeyStorage = ApiKeyStorage.getInstance()