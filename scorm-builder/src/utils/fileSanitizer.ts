/**
 * File name sanitization utility for cross-platform compatibility
 * Ensures filenames are valid on Windows, macOS, and Linux
 */

/**
 * Sanitizes a filename to be safe for all operating systems
 * @param filename - The filename to sanitize
 * @param options - Optional configuration
 * @returns Sanitized filename
 */
export function sanitizeFileName(
  filename: string,
  options: {
    maxLength?: number
    replacement?: string
    allowUnicode?: boolean
  } = {}
): string {
  const {
    maxLength = 200,  // Leave room for path (Windows MAX_PATH is 260)
    replacement = '_',
    allowUnicode = true
  } = options

  if (!filename || typeof filename !== 'string') {
    return 'untitled'
  }

  let sanitized = filename

  // Remove or replace Windows reserved characters: < > : " | ? * \ /
  // Also remove control characters (0-31) and DEL (127)
  const reservedCharsRegex = /[<>:"|?*\\\/\x00-\x1F\x7F]/g
  sanitized = sanitized.replace(reservedCharsRegex, replacement)

  // Remove leading/trailing dots and spaces (Windows doesn't like these)
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '')

  // Replace multiple consecutive spaces or underscores with single
  sanitized = sanitized.replace(/[\s_]+/g, replacement)

  // Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
  ]
  
  const nameWithoutExt = sanitized.replace(/\.[^.]*$/, '')
  const extension = sanitized.match(/\.[^.]*$/)?.[0] || ''
  
  if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
    sanitized = `${replacement}${nameWithoutExt}${extension}`
  }

  // Handle non-ASCII characters if not allowed
  if (!allowUnicode) {
    // Replace non-ASCII characters with underscore
    sanitized = sanitized.replace(/[^\x00-\x7F]/g, replacement)
  }

  // Ensure the filename isn't empty after sanitization
  if (!sanitized || sanitized === replacement) {
    sanitized = 'untitled'
  }

  // Truncate to max length (preserve extension if present)
  if (sanitized.length > maxLength) {
    const ext = sanitized.match(/\.[^.]{1,10}$/)?.[0] || ''
    const nameLength = maxLength - ext.length
    if (nameLength > 0) {
      sanitized = sanitized.substring(0, nameLength) + ext
    } else {
      sanitized = sanitized.substring(0, maxLength)
    }
  }

  return sanitized
}

/**
 * Sanitizes a filename specifically for SCORM packages
 * @param title - The course title to use as filename
 * @returns Sanitized filename with .zip extension
 */
export function sanitizeScormFileName(title?: string): string {
  const baseFilename = title || 'scorm-package'
  const sanitized = sanitizeFileName(baseFilename, {
    maxLength: 150,  // Leave more room for path and .zip extension
    replacement: '-'
  })
  
  // Ensure it doesn't already end with .zip
  if (sanitized.toLowerCase().endsWith('.zip')) {
    return sanitized
  }
  
  return `${sanitized}.zip`
}

/**
 * Validates if a filename is safe for the current platform
 * @param filename - The filename to validate
 * @returns True if the filename is valid
 */
export function isValidFileName(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false
  }

  // Check for reserved characters
  if (/[<>:"|?*\\\/\x00-\x1F\x7F]/.test(filename)) {
    return false
  }

  // Check for leading/trailing dots or spaces
  if (/^[\s.]|[\s.]$/.test(filename)) {
    return false
  }

  // Check for Windows reserved names
  const nameWithoutExt = filename.replace(/\.[^.]*$/, '')
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
  ]
  
  if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
    return false
  }

  // Check length (conservative limit)
  if (filename.length > 255) {
    return false
  }

  return true
}