/**
 * Environment configuration module
 * Centralizes all environment variable access and validation
 */

export interface EnvironmentConfig {
  // API Configuration
  apiEndpoint: string
  
  // External API Keys
  googleImageApiKey: string
  googleCseId: string
  youtubeApiKey: string
  
  // Environment flags
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
  
  // Feature flags
  enableAnalytics?: boolean
  enableErrorReporting?: boolean
  
  // Debug logging control
  debug: {
    mediaRegistry: boolean
    mediaStore: boolean
    scormBuilder: boolean
    audioNarration: boolean
    autoSave: boolean
    fileStorage: boolean
  }
}

/**
 * Get the current environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const mode = import.meta.env.MODE || 'development'
  
  return {
    // API Configuration
    apiEndpoint: import.meta.env.VITE_API_ENDPOINT || '',
    
    // External API Keys
    googleImageApiKey: import.meta.env.VITE_GOOGLE_IMAGE_API_KEY || '',
    googleCseId: import.meta.env.VITE_GOOGLE_CSE_ID || '',
    youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY || '',
    
    // Environment flags
    isDevelopment: mode === 'development',
    isProduction: mode === 'production',
    isTest: mode === 'test',
    
    // Feature flags
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    enableErrorReporting: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    
    // Debug logging control - disabled in production by default
    debug: {
      mediaRegistry: mode === 'development' && import.meta.env.VITE_DEBUG_MEDIA_REGISTRY !== 'false',
      mediaStore: mode === 'development' && import.meta.env.VITE_DEBUG_MEDIA_STORE !== 'false',
      scormBuilder: mode === 'development' && import.meta.env.VITE_DEBUG_SCORM_BUILDER !== 'false',
      audioNarration: mode === 'development' && import.meta.env.VITE_DEBUG_AUDIO_NARRATION !== 'false',
      autoSave: mode === 'development' && import.meta.env.VITE_DEBUG_AUTO_SAVE !== 'false',
      fileStorage: mode === 'development' && import.meta.env.VITE_DEBUG_FILE_STORAGE !== 'false'
    }
  }
}

/**
 * Validate environment configuration
 * Returns validation result with missing required keys
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): {
  isValid: boolean
  missingKeys: string[]
} {
  const missingKeys: string[] = []
  
  // In production, these keys are required
  if (config.isProduction) {
    if (!config.googleImageApiKey) missingKeys.push('googleImageApiKey')
    if (!config.googleCseId) missingKeys.push('googleCseId')
    if (!config.youtubeApiKey) missingKeys.push('youtubeApiKey')
  }
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys
  }
}

/**
 * Get environment variable with type safety
 */
export function getEnvVar(key: string, defaultValue = ''): string {
  return import.meta.env[key] || defaultValue
}

/**
 * Check if running in Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// Export singleton config instance
export const envConfig = getEnvironmentConfig()