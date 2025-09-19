/**
 * Safe deep cloning utility that handles circular references and uses modern APIs
 */

/**
 * Deep clone an object using structuredClone if available, with fallback to JSON methods
 * @param obj The object to clone
 * @returns Deep cloned object
 * @throws Error if object contains circular references and structuredClone is not available
 */
export function safeDeepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // Use structuredClone if available (modern browsers)
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj)
    } catch (error) {
      console.warn('[safeDeepClone] structuredClone failed, falling back to JSON method:', error)
    }
  }

  // Fallback to JSON methods with circular reference detection
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('circular')) {
      throw new Error('Object contains circular references and structuredClone is not available. Consider using a different cloning strategy.')
    }
    throw error
  }
}

/**
 * Check if an object contains circular references
 * @param obj The object to check
 * @returns true if circular references are detected
 */
export function hasCircularReferences(obj: unknown): boolean {
  const seen = new WeakSet()

  function detect(current: unknown): boolean {
    if (current === null || typeof current !== 'object') {
      return false
    }

    if (seen.has(current as object)) {
      return true
    }

    seen.add(current as object)

    if (Array.isArray(current)) {
      for (const item of current) {
        if (detect(item)) return true
      }
    } else {
      for (const value of Object.values(current as Record<string, unknown>)) {
        if (detect(value)) return true
      }
    }

    return false
  }

  return detect(obj)
}

/**
 * Safe clone with circular reference handling
 * Removes circular references by replacing them with [Circular] markers
 * @param obj The object to clone
 * @returns Cloned object with circular references removed
 */
export function safeCloneWithCircularHandling<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  const seen = new WeakMap()

  function cloneRecursive(current: unknown): unknown {
    if (current === null || typeof current !== 'object') {
      return current
    }

    if (seen.has(current as object)) {
      return '[Circular]'
    }

    const cloned = Array.isArray(current) ? [] : {}
    seen.set(current as object, cloned)

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        ;(cloned as unknown[])[i] = cloneRecursive(current[i])
      }
    } else {
      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        ;(cloned as Record<string, unknown>)[key] = cloneRecursive(value)
      }
    }

    return cloned
  }

  return cloneRecursive(obj) as T
}