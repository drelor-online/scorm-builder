import DOMPurify from 'dompurify'

export interface SanitizerOptions {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
  allowStyles?: boolean
  allowedProtocols?: string[]
  transformTags?: Record<string, string>
  allowDataUrls?: boolean
}

const DEFAULT_ALLOWED_TAGS = [
  'p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'a', 'abbr', 'acronym',
  'b', 'blockquote', 'cite', 'code', 'del', 'em', 'i', 'ins',
  'kbd', 'mark', 'pre', 's', 'samp', 'small', 'strong', 'sub',
  'sup', 'time', 'u', 'var', 'img', 'audio', 'video', 'source',
  'track', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'caption', 'col', 'colgroup', 'hr', 'figure', 'figcaption',
  'picture', 'source', 'button', 'form', 'input', 'label', 'select',
  'option', 'textarea', 'fieldset', 'legend'
]

const DEFAULT_ALLOWED_ATTRIBUTES = {
  '*': ['class', 'id', 'lang', 'dir', 'title'],
  'a': ['href', 'target', 'rel', 'download', 'type'],
  'img': ['src', 'alt', 'width', 'height', 'loading'],
  'audio': ['src', 'controls', 'preload', 'loop', 'muted', 'autoplay'],
  'video': ['src', 'controls', 'preload', 'loop', 'muted', 'autoplay', 'poster', 'width', 'height'],
  'source': ['src', 'type', 'media'],
  'track': ['src', 'kind', 'srclang', 'label', 'default'],
  'input': ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'readonly', 'checked'],
  'button': ['type', 'disabled'],
  'form': ['action', 'method', 'enctype'],
  'label': ['for'],
  'select': ['name', 'multiple', 'required', 'disabled'],
  'option': ['value', 'selected', 'disabled'],
  'textarea': ['name', 'rows', 'cols', 'placeholder', 'required', 'disabled', 'readonly'],
  'table': ['border', 'cellpadding', 'cellspacing'],
  'th': ['colspan', 'rowspan', 'scope'],
  'td': ['colspan', 'rowspan']
}

const SAFE_PROTOCOLS = ['http', 'https', 'ftp', 'mailto', 'tel', '#']

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export function sanitizeHTML(dirty: string, options: SanitizerOptions = {}): string {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }

  const config: any = {
    ALLOWED_TAGS: options.allowedTags || DEFAULT_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto|tel|#):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false
  }

  // Build allowed attributes list
  const allowedAttrs = { ...DEFAULT_ALLOWED_ATTRIBUTES, ...options.allowedAttributes }
  for (const [, attrs] of Object.entries(allowedAttrs)) {
    for (const attr of attrs) {
      config.ALLOWED_ATTR.push(attr)
    }
  }

  // Handle styles
  if (options.allowStyles) {
    config.ALLOWED_ATTR.push('style')
  } else {
    config.FORBID_ATTR = ['style']
  }

  // Handle protocols
  if (options.allowedProtocols) {
    const protocols = [...SAFE_PROTOCOLS, ...options.allowedProtocols]
    const protocolPattern = protocols.join('|')
    config.ALLOWED_URI_REGEXP = new RegExp(`^(?:(?:${protocolPattern}):|[^a-z]|[a-z+.-]+(?:[^a-z+.\\-:]|$))`, 'i')
  }

  // Handle tag transformations
  if (options.transformTags) {
    config.SANITIZE_DOM = false
    config.ALLOW_UNKNOWN_PROTOCOLS = false
  }

  let clean = String(DOMPurify.sanitize(dirty, config))

  // Apply tag transformations if specified
  if (options.transformTags) {
    for (const [oldTag, newTag] of Object.entries(options.transformTags)) {
      const regex = new RegExp(`<${oldTag}([^>]*)>`, 'gi')
      const closeRegex = new RegExp(`</${oldTag}>`, 'gi')
      clean = clean.replace(regex, `<${newTag}$1>`)
      clean = clean.replace(closeRegex, `</${newTag}>`)
    }
  }

  return clean
}

/**
 * Escapes string for safe use in HTML attributes
 */
export function sanitizeForAttribute(value: string): string {
  if (!value || typeof value !== 'string') {
    return ''
  }

  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }

  return value.replace(/[&<>"'/]/g, char => escapeMap[char])
}

/**
 * Sanitizes URLs to prevent XSS via javascript: and data: protocols
 */
export function sanitizeForURL(url: string, options: { allowDataUrls?: boolean } = {}): string {
  if (!url || typeof url !== 'string') {
    return '#'
  }

  // Remove whitespace and control characters
  const cleaned = url.trim().replace(/[\s\t\n\r]/g, '')

  // Check for dangerous protocols
  const dangerousProtocols = /^(javascript|vbscript|file|data):/i
  
  if (dangerousProtocols.test(cleaned)) {
    // Allow specific data URLs if option is set
    if (options.allowDataUrls && cleaned.startsWith('data:')) {
      // Only allow image data URLs
      const safeDataUrl = /^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp);base64,/i
      if (safeDataUrl.test(cleaned)) {
        return url
      }
    }
    return '#'
  }

  return url
}

/**
 * Creates a custom sanitizer with specific options
 */
export function createSanitizer(options: SanitizerOptions): (dirty: string) => string {
  return (dirty: string) => sanitizeHTML(dirty, options)
}

/**
 * Sanitizes content specifically for SCORM packages
 */
export function sanitizeForSCORM(content: string): string {
  const scormOptions: SanitizerOptions = {
    allowedAttributes: {
      ...DEFAULT_ALLOWED_ATTRIBUTES,
      'div': [...(DEFAULT_ALLOWED_ATTRIBUTES['*'] || []), 'data-scorm-element', 'data-scorm-id'],
      'span': [...(DEFAULT_ALLOWED_ATTRIBUTES['*'] || []), 'data-scorm-element', 'data-scorm-id'],
      '*': [...(DEFAULT_ALLOWED_ATTRIBUTES['*'] || []), 'data-scorm-objective', 'data-scorm-interaction']
    },
    allowStyles: false, // Styles should be in external CSS for SCORM
    allowDataUrls: true // Allow data URLs for embedded images
  }

  return sanitizeHTML(content, scormOptions)
}

/**
 * Utility to check if content needs sanitization
 */
export function needsSanitization(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false
  }

  // Check for common XSS patterns
  const xssPatterns = [
    /<script[\s>]/i,
    /on\w+\s*=/i, // Event handlers
    /javascript:/i,
    /vbscript:/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /<style/i
  ]

  return xssPatterns.some(pattern => pattern.test(content))
}