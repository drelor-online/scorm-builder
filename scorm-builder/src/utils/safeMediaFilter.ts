/**
 * Type-safe media filtering utility
 * Handles cases where media arrays become corrupted with wrong types
 */

/**
 * Safely filters media arrays with comprehensive type checking
 * @param media - The media value to filter (could be any type due to runtime corruption)
 * @param filterFn - The filter function to apply to array elements
 * @returns Array of filtered media items, or empty array if media is invalid
 */
export function safeMediaFilter<T = any>(
  media: any,
  filterFn: (item: T) => boolean
): T[] {
  // Step 1: Null/undefined check
  if (!media) {
    return []
  }

  // Step 2: Array type check - this is what was missing!
  if (!Array.isArray(media)) {
    console.error('[safeMediaFilter] Media is not an array:', {
      type: typeof media,
      value: media,
      constructor: media?.constructor?.name
    })
    return []
  }

  // Step 3: Safe to filter
  try {
    return media.filter(filterFn)
  } catch (error) {
    console.error('[safeMediaFilter] Error filtering media array:', error)
    return []
  }
}

/**
 * Ensures a value is always a valid array
 * @param value - The value to ensure is an array
 * @returns Array version of the value, or empty array if invalid
 */
export function ensureArray<T = any>(value: any): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value

  // Single item - wrap in array
  if (typeof value === 'object' && value.constructor === Object) {
    console.warn('[ensureArray] Converting single object to array:', value)
    return [value]
  }

  console.error('[ensureArray] Cannot convert to array:', typeof value, value)
  return []
}

/**
 * Type guard to check if a value is a valid media array
 * @param value - The value to check
 * @returns True if value is an array, false otherwise
 */
export function isValidMediaArray(value: any): value is any[] {
  return Array.isArray(value)
}