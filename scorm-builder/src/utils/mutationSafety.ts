/**
 * Development-mode utility to prevent accidental mutations of immutable data structures
 * This helps catch bugs where components directly mutate props instead of creating new objects
 */

/**
 * Deep freeze an object and all its nested properties (development mode only)
 * In production, this is a no-op for performance
 */
export function deepFreeze<T>(obj: T): T {
  // Only freeze in development mode
  if (process.env.NODE_ENV !== 'development') {
    return obj
  }

  // Handle null, undefined, or primitive values
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    // Freeze each element recursively
    obj.forEach(item => deepFreeze(item))
    return Object.freeze(obj)
  }

  // Handle objects
  Object.getOwnPropertyNames(obj).forEach(name => {
    const value = (obj as any)[name]
    
    // Recursively freeze nested objects
    if (value && typeof value === 'object') {
      deepFreeze(value)
    }
  })

  return Object.freeze(obj)
}

/**
 * Create a development-safe wrapper for course content that prevents mutations
 * This will throw errors immediately if any component tries to mutate the content
 */
export function createMutationSafeContent<T>(content: T): T {
  if (process.env.NODE_ENV !== 'development') {
    // In production, just return the content as-is for performance
    return content
  }

  if (!content || typeof content !== 'object') {
    return content
  }

  // Deep freeze the content to prevent any mutations
  return deepFreeze({ ...content }) as T
}

/**
 * Check if an object has been frozen (useful for debugging)
 */
export function isFrozen(obj: any): boolean {
  return Object.isFrozen(obj)
}

/**
 * Development-only validation function to ensure immutable updates
 * Call this after state updates to verify no mutations occurred
 */
export function validateImmutableUpdate<T>(original: T, updated: T, context: string): void {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  if (original === updated && original !== null && typeof original === 'object') {
    console.warn(
      `[MutationSafety] Potential mutation detected in ${context}. ` +
      `The updated value is the same object reference as the original. ` +
      `This may indicate in-place mutation instead of immutable update.`,
      { original, updated }
    )
  }
}