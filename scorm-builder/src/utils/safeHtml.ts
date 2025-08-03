import DOMPurify from 'dompurify';

// For browser environment, use the global window
// For Node.js/testing, we'll create a mock DOMPurify
let purify: typeof DOMPurify;

if (typeof window !== 'undefined' && window.document) {
  // Browser environment
  purify = DOMPurify(window);
} else {
  // Node.js/test environment - create a simple sanitizer
  purify = {
    sanitize: (html: string, _config?: any) => {
      // Simple sanitization for tests - remove script tags and dangerous attributes
      let cleaned = html
        // Remove script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove on* event handlers
        .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
        // Remove javascript: in attributes
        .replace(/(\s(?:href|src)\s*=\s*["'])javascript:[^"']*/gi, '$1#');
      
      // Don't remove href/src attributes that don't contain javascript:
      // This allows normal links and images to work
      
      return cleaned;
    }
  } as typeof DOMPurify;
}

// Configure DOMPurify to allow safe HTML tags but remove dangerous ones
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 
  'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 
  'h4', 'h5', 'h6', 'mark', 'sub', 'sup', 'hr', 'div', 'span'
];

const ALLOWED_ATTRIBUTES = {
  'a': ['href', 'title', 'target', 'rel'],
  '*': ['class', 'style'] // Allow class and style on all elements
};

/**
 * Sanitize HTML content to allow safe formatting while preventing XSS
 * @param html The HTML content to sanitize
 * @returns Sanitized HTML that is safe to render
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // In test environment, just use our simple sanitizer
  if (typeof window === 'undefined') {
    return purify.sanitize(html);
  }
  
  // Configure DOMPurify for browser
  // DOMPurify expects a flat array of allowed attribute names
  const allowedAttrs = new Set<string>();
  Object.values(ALLOWED_ATTRIBUTES).forEach(attrs => {
    attrs.forEach(attr => allowedAttrs.add(attr));
  });
  
  const config = {
    ALLOWED_TAGS,
    ALLOWED_ATTR: Array.from(allowedAttrs),
    KEEP_CONTENT: true,
    FORCE_BODY: true
  };
  
  // Sanitize the HTML
  return purify.sanitize(html, config);
}

/**
 * Process content that may contain HTML, sanitizing it for safe display
 * @param content The content to process
 * @returns Processed content safe for rendering
 */
export function processHtmlContent(content: string): string {
  if (!content) return '';
  
  // If content doesn't contain any HTML tags, just return it as-is
  if (!/<[^>]+>/.test(content)) {
    return content;
  }
  
  // Otherwise, sanitize it
  return sanitizeHtml(content);
}