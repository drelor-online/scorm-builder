/**
 * Security configuration for the application
 */

/**
 * Content Security Policy configuration
 * Defines allowed sources for different resource types
 */
export const CSP_CONFIG = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    // 'unsafe-inline' removed for production security
    // 'unsafe-eval' will be conditionally added only in development
    "https://apis.google.com" // For Google APIs
  ],
  'style-src': [
    "'self'",
    // Consider using CSS-in-JS or nonces instead of unsafe-inline
    "https://fonts.googleapis.com"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com"
  ],
  'img-src': [
    "'self'",
    "data:", // For base64 images
    "blob:", // For blob URLs
    "https:" // HTTPS only for external images
  ],
  'media-src': [
    "'self'",
    "blob:", // For blob URLs
    "https:" // HTTPS only for external media
  ],
  'connect-src': [
    "'self'",
    "https://www.googleapis.com", // Google APIs
    "https://youtube.googleapis.com", // YouTube API
    "ws:", // WebSocket for development
    "wss:" // Secure WebSocket
  ],
  'frame-src': [
    "'self'",
    "https://www.youtube.com", // For YouTube embeds
    "https://player.vimeo.com" // For Vimeo embeds
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"], // Prevent clickjacking
  'upgrade-insecure-requests': [] // Force HTTPS in production
}

/**
 * Generate CSP header string from configuration
 */
export function generateCSPHeader(isDevelopment = false): string {
  const config: Record<string, string[]> = { ...CSP_CONFIG }
  
  // Relax CSP in development
  if (isDevelopment) {
    config['script-src'].push("'unsafe-eval'")
    config['script-src'].push("'unsafe-inline'") // Only in development
    config['style-src'].push("'unsafe-inline'") // Only in development
    config['img-src'].push("http:") // Allow HTTP in development
    config['media-src'].push("http:") // Allow HTTP in development
    // Remove upgrade-insecure-requests in development
    if ('upgrade-insecure-requests' in config) {
      delete config['upgrade-insecure-requests']
    }
  } else {
    // Production: strict CSP without unsafe-inline or unsafe-eval
    config['script-src'] = config['script-src'].filter(src => src !== "'unsafe-eval'" && src !== "'unsafe-inline'")
    config['style-src'] = config['style-src'].filter(src => src !== "'unsafe-inline'")
  }
  
  return Object.entries(config)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}

/**
 * Get security headers for the current environment
 */
export function getSecurityHeaders(isDevelopment = false): Record<string, string> {
  const headers: Record<string, string> = { ...SECURITY_HEADERS }
  
  // Add CSP header
  headers['Content-Security-Policy'] = generateCSPHeader(isDevelopment)
  
  // Remove HSTS in development
  if (isDevelopment && 'Strict-Transport-Security' in headers) {
    delete headers['Strict-Transport-Security']
  }
  
  return headers
}