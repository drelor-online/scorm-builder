/**
 * Browser-compatible Path Sanitization utility
 * Prevents directory traversal attacks without using Node.js path module
 */

import { logger } from './logger'

export interface PathSanitizationOptions {
  baseDir?: string
  allowAbsolute?: boolean
  allowDotFiles?: boolean
  maxDepth?: number
  allowedExtensions?: string[]
  blockedPatterns?: RegExp[]
}

export class PathTraversalError extends Error {
  constructor(message: string, public path: string, public reason: string) {
    super(message)
    this.name = 'PathTraversalError'
  }
}

const DANGEROUS_PATTERNS = [
  /\.\.[\/\\]/g,  // ../ or ..\
  /^\//,          // Absolute paths starting with /
  /^[A-Za-z]:[\/\\]/, // Windows absolute paths
  /^\\\\/, // UNC paths
  /\0/g,   // Null bytes
  /%2e%2e/gi, // URL encoded ../
  /%252e%252e/gi, // Double URL encoded ../
  /\u0000/g, // Unicode null
]

const DEFAULT_BLOCKED_PATTERNS = [
  /node_modules/i,
  /\.git/i,
  /\.env/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /\.npmrc$/i,
  /\.gitignore$/i,
  /\.dockerignore$/i,
  /Dockerfile$/i,
  /docker-compose/i,
  /\.ssh/i,
  /\.aws/i,
  /\.kube/i,
  /private/i,
  /secret/i,
  /credential/i,
  /password/i,
  /token/i,
  /key\.pem$/i,
  /\.key$/i,
  /\.cert$/i,
  /\.crt$/i,
]

/**
 * Browser-compatible path utilities
 */
const pathUtils = {
  isAbsolute(filePath: string): boolean {
    return /^\//.test(filePath) || /^[A-Za-z]:[\/\\]/.test(filePath) || /^\\\\/.test(filePath)
  },

  join(...parts: string[]): string {
    return parts
      .filter(part => part && part.length > 0)
      .join('/')
      .replace(/\/+/g, '/') // Remove duplicate slashes
      .replace(/\/\.\//g, '/') // Remove ./ sequences
      .replace(/([^/]+)\/\.\.\//g, '') // Remove dir/../ sequences
      .replace(/\/$/, '') // Remove trailing slash unless it's root
  },

  basename(filePath: string): string {
    const parts = filePath.split(/[/\\]/)
    return parts[parts.length - 1] || ''
  },

  extname(filePath: string): string {
    const base = pathUtils.basename(filePath)
    const lastDot = base.lastIndexOf('.')
    if (lastDot === -1 || lastDot === 0) return ''
    return base.substring(lastDot)
  },

  dirname(filePath: string): string {
    const parts = filePath.split(/[/\\]/)
    parts.pop()
    return parts.join('/') || '/'
  },

  normalize(filePath: string): string {
    // Normalize slashes
    let normalized = filePath.replace(/\\/g, '/')
    
    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/')
    
    // Handle . and .. sequences
    const parts = normalized.split('/')
    const result: string[] = []
    
    for (const part of parts) {
      if (part === '..') {
        if (result.length > 0 && result[result.length - 1] !== '..') {
          result.pop()
        } else if (!pathUtils.isAbsolute(filePath)) {
          result.push('..')
        }
      } else if (part !== '.' && part !== '') {
        result.push(part)
      }
    }
    
    return result.join('/') || '.'
  }
}

/**
 * Sanitize a file path to prevent directory traversal attacks
 */
export function sanitizePath(
  inputPath: string, 
  options: PathSanitizationOptions = {}
): { safe: boolean; sanitized: string; reason?: string } {
  if (!inputPath || typeof inputPath !== 'string') {
    return { safe: false, sanitized: '', reason: 'Invalid input path' }
  }

  const {
    allowAbsolute = false,
    allowDotFiles = true,
    maxDepth = 10,
    allowedExtensions = [],
    blockedPatterns = DEFAULT_BLOCKED_PATTERNS
  } = options

  try {
    // Decode any URL encoding
    let decodedPath = inputPath
    try {
      decodedPath = decodeURIComponent(inputPath)
    } catch {
      // If decoding fails, use original
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(decodedPath)) {
        logger.warn('[PathSanitizer] Dangerous pattern detected:', pattern, decodedPath)
        return { safe: false, sanitized: '', reason: `Dangerous pattern: ${pattern}` }
      }
    }

    // Check if absolute path
    if (!allowAbsolute && pathUtils.isAbsolute(decodedPath)) {
      return { safe: false, sanitized: '', reason: 'Absolute paths not allowed' }
    }

    // Normalize the path
    const normalized = pathUtils.normalize(decodedPath)

    // Check depth
    const depth = normalized.split('/').filter(p => p && p !== '.').length
    if (depth > maxDepth) {
      return { safe: false, sanitized: '', reason: `Path too deep: ${depth} > ${maxDepth}` }
    }

    // Check for dot files
    if (!allowDotFiles && /\/\.[^/]+$/.test(normalized)) {
      return { safe: false, sanitized: '', reason: 'Dot files not allowed' }
    }

    // Check blocked patterns
    for (const pattern of blockedPatterns) {
      if (pattern.test(normalized)) {
        return { safe: false, sanitized: '', reason: `Blocked pattern: ${pattern}` }
      }
    }

    // Check allowed extensions
    if (allowedExtensions.length > 0) {
      const ext = pathUtils.extname(normalized).toLowerCase()
      if (!allowedExtensions.includes(ext)) {
        return { safe: false, sanitized: '', reason: `Extension not allowed: ${ext}` }
      }
    }

    return { safe: true, sanitized: normalized }

  } catch (error) {
    logger.error('[PathSanitizer] Error sanitizing path:', error)
    return { safe: false, sanitized: '', reason: 'Error processing path' }
  }
}

/**
 * Sanitize a filename (no directory components allowed)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file'
  }

  // Remove any directory separators
  let safe = filename.replace(/[/\\]/g, '_')
  
  // Remove dangerous characters
  safe = safe.replace(/[<>:"|?*\0]/g, '_')
  
  // Remove control characters
  safe = safe.replace(/[\x00-\x1f\x80-\x9f]/g, '_')
  
  // Limit length
  if (safe.length > 255) {
    const ext = pathUtils.extname(safe)
    const base = safe.substring(0, 255 - ext.length)
    safe = base + ext
  }
  
  // Don't allow only dots
  if (/^\.+$/.test(safe)) {
    safe = 'file'
  }
  
  // Don't allow empty
  if (!safe) {
    safe = 'file'
  }
  
  return safe
}

/**
 * Validate that a path stays within a base directory
 */
export function isPathWithinBase(targetPath: string, basePath: string): boolean {
  try {
    const normalizedTarget = pathUtils.normalize(targetPath)
    const normalizedBase = pathUtils.normalize(basePath)
    
    // Simple check: target should start with base
    return normalizedTarget.startsWith(normalizedBase)
  } catch {
    return false
  }
}

/**
 * Path sanitization presets for common use cases
 */
export const PathSanitizers = {
  /**
   * For user uploads - very restrictive
   */
  userUpload: (filePath: string) => sanitizePath(filePath, {
    allowAbsolute: false,
    allowDotFiles: false,
    maxDepth: 3,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.pdf'],
    blockedPatterns: [...DEFAULT_BLOCKED_PATTERNS, /\.\./]
  }),

  /**
   * For internal file operations - less restrictive
   */
  internal: (filePath: string) => sanitizePath(filePath, {
    allowAbsolute: false,
    allowDotFiles: true,
    maxDepth: 10,
    blockedPatterns: DEFAULT_BLOCKED_PATTERNS
  }),

  /**
   * For media files specifically
   */
  media: (filePath: string) => sanitizePath(filePath, {
    allowAbsolute: false,
    allowDotFiles: false,
    maxDepth: 5,
    allowedExtensions: [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
      // Videos
      '.mp4', '.webm', '.mov', '.avi', '.mkv',
      // Audio
      '.mp3', '.wav', '.ogg', '.m4a', '.flac',
      // Captions
      '.vtt', '.srt'
    ]
  })
}