/**
 * Production-safe cloning utilities for mutation safety
 * 
 * IMPORTANT: In production builds, deep freezing is disabled for performance.
 * These utilities help ensure objects are properly cloned before mutation
 * to prevent subtle bugs that might not surface during development.
 */

/**
 * Performs a shallow clone of an object, suitable for most component state updates
 * Use this when you need to modify properties at the top level of an object.
 * 
 * @example
 * ```typescript
 * const newContent = shallowClone(courseContent);
 * newContent.title = "Updated Title";
 * ```
 */
export function shallowClone<T extends object>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return [...obj] as T;
  }
  
  return { ...obj };
}

/**
 * Performs a deep clone of an object, creating new instances at all levels
 * Use this when you need to modify nested properties or arrays.
 * 
 * @example
 * ```typescript
 * const newContent = deepClone(courseContent);
 * newContent.topics[0].title = "Updated Topic";
 * newContent.welcomePage.media.push(newMedia);
 * ```
 * 
 * Note: This function uses JSON.parse/stringify, so it will not preserve:
 * - Functions
 * - undefined values
 * - Symbols
 * - Date objects (converted to strings)
 * - Blob objects (lost in serialization)
 * 
 * For objects containing Blobs or other non-serializable data, use structuredClone() 
 * if available, or implement custom cloning logic.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Use structured clone if available (modern browsers)
  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(obj);
    } catch {
      // Fall back to JSON method if structuredClone fails
    }
  }
  
  // Fallback to JSON clone (loses non-serializable data)
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // If JSON serialization fails, fall back to shallow clone
    return shallowClone(obj as any);
  }
}

/**
 * Safely updates an object property by cloning the object first
 * This is a helper for the common pattern of clone-then-modify.
 * 
 * @example
 * ```typescript
 * const newContent = safeUpdate(courseContent, (draft) => {
 *   draft.title = "New Title";
 *   draft.topics[0].content = "Updated content";
 * });
 * ```
 */
export function safeUpdate<T extends object>(
  obj: T, 
  updater: (draft: T) => void,
  useDeepClone = true
): T {
  const clone = useDeepClone ? deepClone(obj) : shallowClone(obj);
  updater(clone);
  return clone;
}

/**
 * Type guard to check if an object is likely mutable
 * In development, frozen objects will return false.
 * In production, this always returns true since freezing is disabled.
 */
export function isMutable(obj: any): boolean {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }
  
  // In development, check if object is frozen
  if (process.env.NODE_ENV === 'development') {
    return !Object.isFrozen(obj);
  }
  
  // In production, assume all objects are mutable
  return true;
}

/**
 * Asserts that an object is mutable (not frozen) in development
 * Throws an error if the object is frozen, helping catch mutation attempts
 * on immutable objects during development.
 */
export function assertMutable(obj: any, objectName = 'object'): void {
  if (process.env.NODE_ENV === 'development') {
    if (!isMutable(obj)) {
      throw new Error(
        `Attempted to mutate frozen ${objectName}. ` +
        'Use cloning utilities (shallowClone/deepClone) before mutation.'
      );
    }
  }
}