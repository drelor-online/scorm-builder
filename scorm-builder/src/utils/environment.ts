/**
 * Environment detection utilities
 * Determines if running in Tauri, browser, or Node.js environment
 */

/**
 * Check if we're running in a Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && 
    window !== null && 
    '__TAURI__' in window &&
    window.__TAURI__ !== undefined
}

/**
 * Check if we're running in a browser environment
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && 
    typeof document !== 'undefined' &&
    !isTauriEnvironment() &&
    !isNodeEnvironment()
}

/**
 * Check if we're running in a Node.js environment
 */
export function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && 
    process.versions != null && 
    process.versions.node != null
}

/**
 * Check if we're running in a test environment
 */
export function isTestEnvironment(): boolean {
  return import.meta.env.VITEST === true || 
    (typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined)
}

/**
 * Check if we're running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV === true
}

/**
 * Check if we're running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD === true
}

/**
 * Get the current environment type
 */
export type EnvironmentType = 'tauri' | 'browser' | 'node' | 'test'

export function getEnvironmentType(): EnvironmentType {
  if (isTestEnvironment()) return 'test'
  if (isTauriEnvironment()) return 'tauri'
  if (isBrowserEnvironment()) return 'browser'
  if (isNodeEnvironment()) return 'node'
  return 'browser' // Default fallback
}

/**
 * Check if Tauri APIs are available
 */
export function hasTauriAPI(): boolean {
  if (!isTauriEnvironment()) return false
  
  try {
    // Check if we can access Tauri invoke
    return typeof window.__TAURI__?.invoke === 'function'
  } catch {
    return false
  }
}

/**
 * Check if IndexedDB is available (for browser storage)
 */
export function hasIndexedDB(): boolean {
  return typeof window !== 'undefined' && 
    'indexedDB' in window &&
    window.indexedDB !== null
}

/**
 * Check if localStorage is available
 */
export function hasLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    // Test if we can actually use it
    const testKey = '__localStorage_test__'
    window.localStorage.setItem(testKey, 'test')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Get appropriate storage backend based on environment
 */
export type StorageBackend = 'tauri' | 'indexeddb' | 'memory'

export function getStorageBackend(): StorageBackend {
  if (hasTauriAPI()) return 'tauri'
  if (hasIndexedDB()) return 'indexeddb'
  return 'memory' // Fallback for tests or restricted environments
}

/**
 * Environment info for debugging
 */
export function getEnvironmentInfo(): Record<string, any> {
  return {
    type: getEnvironmentType(),
    isTauri: isTauriEnvironment(),
    isBrowser: isBrowserEnvironment(),
    isNode: isNodeEnvironment(),
    isTest: isTestEnvironment(),
    isDev: isDevelopment(),
    isProd: isProduction(),
    hasTauriAPI: hasTauriAPI(),
    hasIndexedDB: hasIndexedDB(),
    hasLocalStorage: hasLocalStorage(),
    storageBackend: getStorageBackend(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    nodeVersion: isNodeEnvironment() ? process.version : 'N/A'
  }
}