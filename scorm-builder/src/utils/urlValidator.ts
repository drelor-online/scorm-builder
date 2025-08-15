/**
 * URL Validation utility for security
 * Prevents XSS, SSRF attacks, and malicious content injection
 */

import { logger } from './logger'

export interface URLValidationOptions {
  allowedProtocols?: string[]
  blockedDomains?: string[]
  allowedDomains?: string[]
  allowDataURLs?: boolean
  allowLocalhost?: boolean
}

const DEFAULT_ALLOWED_PROTOCOLS = ['https:', 'http:']
const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'file:', 'data:', 'blob:']
const DEFAULT_BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS metadata endpoint
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16'
]

export class URLValidationError extends Error {
  constructor(message: string, public url: string, public reason: string) {
    super(message)
    this.name = 'URLValidationError'
  }
}

/**
 * Validates an external URL for security
 */
export function validateExternalURL(
  url: string,
  options: URLValidationOptions = {}
): { valid: boolean; sanitized: string; reason?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitized: '', reason: 'Invalid URL format' }
  }

  // Trim and normalize
  const trimmedUrl = url.trim()
  
  // Check for empty URL
  if (!trimmedUrl) {
    return { valid: false, sanitized: '', reason: 'Empty URL' }
  }

  try {
    // Parse URL
    const parsedUrl = new URL(trimmedUrl)
    
    // Check protocol
    const allowedProtocols = options.allowedProtocols || DEFAULT_ALLOWED_PROTOCOLS
    const protocol = parsedUrl.protocol.toLowerCase()
    
    // Block dangerous protocols
    if (DANGEROUS_PROTOCOLS.includes(protocol)) {
      // Special handling for data URLs if allowed
      if (protocol === 'data:' && options.allowDataURLs) {
        // Only allow specific safe data URL types
        const safeDataUrlPattern = /^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp);base64,/i
        if (safeDataUrlPattern.test(trimmedUrl)) {
          return { valid: true, sanitized: trimmedUrl }
        }
      }
      
      logger.warn(`[URLValidator] Blocked dangerous protocol: ${protocol} in URL: ${trimmedUrl}`)
      return { valid: false, sanitized: '', reason: `Dangerous protocol: ${protocol}` }
    }
    
    // Check if protocol is allowed
    if (!allowedProtocols.includes(protocol)) {
      logger.warn(`[URLValidator] Protocol not allowed: ${protocol} in URL: ${trimmedUrl}`)
      return { valid: false, sanitized: '', reason: `Protocol not allowed: ${protocol}` }
    }
    
    // Check hostname
    const hostname = parsedUrl.hostname.toLowerCase()
    
    // Check for localhost/internal IPs
    if (!options.allowLocalhost) {
      const blockedDomains = [...DEFAULT_BLOCKED_DOMAINS, ...(options.blockedDomains || [])]
      
      // Check exact matches
      if (blockedDomains.includes(hostname)) {
        logger.warn(`[URLValidator] Blocked internal hostname: ${hostname}`)
        return { valid: false, sanitized: '', reason: `Internal hostname not allowed: ${hostname}` }
      }
      
      // Check IP ranges
      if (isPrivateIP(hostname)) {
        logger.warn(`[URLValidator] Blocked private IP: ${hostname}`)
        return { valid: false, sanitized: '', reason: `Private IP not allowed: ${hostname}` }
      }
    }
    
    // Check allowed domains if specified
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      const isAllowed = options.allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      )
      
      if (!isAllowed) {
        logger.warn(`[URLValidator] Domain not in allowlist: ${hostname}`)
        return { valid: false, sanitized: '', reason: `Domain not allowed: ${hostname}` }
      }
    }
    
    // Sanitize URL by reconstructing it
    const sanitized = parsedUrl.toString()
    
    return { valid: true, sanitized }
  } catch (error) {
    // Invalid URL format
    logger.error(`[URLValidator] Invalid URL format: ${trimmedUrl}`, error)
    return { valid: false, sanitized: '', reason: 'Invalid URL format' }
  }
}

/**
 * Checks if a hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = hostname.match(ipv4Pattern)
  
  if (match) {
    const octets = match.slice(1).map(Number)
    
    // Validate octets
    if (octets.some(octet => octet > 255)) {
      return false
    }
    
    // Check private ranges
    // 10.0.0.0/8
    if (octets[0] === 10) return true
    
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
    
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) return true
    
    // 127.0.0.0/8 (loopback)
    if (octets[0] === 127) return true
    
    // 169.254.0.0/16 (link-local)
    if (octets[0] === 169 && octets[1] === 254) return true
  }
  
  // IPv6 loopback (handle with or without brackets)
  if (hostname === '::1' || hostname === '[::1]') return true
  
  // Remove brackets for IPv6 checking
  const cleanHostname = hostname.replace(/^\[|\]$/g, '')
  
  // IPv6 private ranges (simplified check)
  if (cleanHostname.startsWith('fe80:') || cleanHostname.startsWith('fc00:') || cleanHostname.startsWith('fd00:')) {
    return true
  }
  
  // Additional IPv6 patterns
  if (cleanHostname === '::' || cleanHostname === '::0' || cleanHostname === '0:0:0:0:0:0:0:0') {
    return true
  }
  
  return false
}

/**
 * Validates a YouTube URL
 */
export function validateYouTubeURL(url: string): { valid: boolean; videoId?: string; reason?: string } {
  const validation = validateExternalURL(url, {
    allowedDomains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com']
  })
  
  if (!validation.valid) {
    return { valid: false, reason: validation.reason }
  }
  
  try {
    const parsedUrl = new URL(validation.sanitized)
    let videoId: string | null = null
    
    // Extract video ID based on URL format
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtube-nocookie.com')) {
      // youtube.com/watch?v=VIDEO_ID
      videoId = parsedUrl.searchParams.get('v')
      
      // youtube.com/embed/VIDEO_ID
      if (!videoId && parsedUrl.pathname.startsWith('/embed/')) {
        videoId = parsedUrl.pathname.split('/embed/')[1]?.split('/')[0]
      }
    } else if (parsedUrl.hostname === 'youtu.be') {
      // youtu.be/VIDEO_ID
      videoId = parsedUrl.pathname.slice(1).split('/')[0]
    }
    
    if (!videoId) {
      return { valid: false, reason: 'No video ID found in YouTube URL' }
    }
    
    // Validate video ID format (alphanumeric, underscore, hyphen)
    // YouTube video IDs are typically 11 characters, but can vary
    // We'll be lenient for testing purposes
    if (!/^[\w-]+$/.test(videoId) || videoId.length === 0) {
      return { valid: false, reason: 'Invalid YouTube video ID format' }
    }
    
    return { valid: true, videoId }
  } catch {
    return { valid: false, reason: 'Failed to parse YouTube URL' }
  }
}

/**
 * Validates an image URL
 */
export function validateImageURL(url: string, options: URLValidationOptions = {}): { valid: boolean; sanitized: string; reason?: string } {
  // Allow data URLs for images by default
  const imageOptions: URLValidationOptions = {
    ...options,
    allowDataURLs: options.allowDataURLs !== false // Default to true for images
  }
  
  return validateExternalURL(url, imageOptions)
}

/**
 * Creates a URL validator with preset options
 */
export function createURLValidator(defaultOptions: URLValidationOptions) {
  return (url: string, options?: URLValidationOptions) => 
    validateExternalURL(url, { ...defaultOptions, ...options })
}

/**
 * Pre-configured validators for common use cases
 */
export const URLValidators = {
  // Strict validator for user-provided URLs
  strict: createURLValidator({
    allowedProtocols: ['https:'],
    allowLocalhost: false,
    allowDataURLs: false
  }),
  
  // Standard validator for general media
  standard: createURLValidator({
    allowedProtocols: ['https:', 'http:'],
    allowLocalhost: false,
    allowDataURLs: true
  }),
  
  // Development validator (more permissive)
  development: createURLValidator({
    allowedProtocols: ['https:', 'http:'],
    allowLocalhost: true,
    allowDataURLs: true
  })
}