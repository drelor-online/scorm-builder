import { describe, it, expect, vi } from 'vitest'
import {
  sanitizeHTML,
  sanitizeForAttribute,
  sanitizeForURL,
  createSanitizer,
  sanitizeForSCORM,
  needsSanitization
} from '../sanitization'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((dirty: string, config: any) => {
      // Simple mock implementation for testing
      if (dirty.includes('<script>')) return dirty.replace(/<script[^>]*>.*?<\/script>/gi, '')
      if (dirty.includes('javascript:')) return dirty.replace(/javascript:/gi, '')
      
      // Remove event handlers
      let cleaned = dirty.replace(/\son\w+\s*=/gi, '')
      
      // Handle allowed tags
      if (config && config.ALLOWED_TAGS) {
        const allowedTags = config.ALLOWED_TAGS
        const tagRegex = /<(\/?[^>\s]+)[^>]*>/g
        cleaned = cleaned.replace(tagRegex, (match, tag) => {
          const tagName = tag.replace('/', '').toLowerCase()
          if (allowedTags.includes(tagName) || allowedTags.includes('/' + tagName)) {
            return match
          }
          return ''
        })
      }
      
      // Handle forbidden attributes
      if (config && config.FORBID_ATTR) {
        config.FORBID_ATTR.forEach((attr: string) => {
          const attrRegex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
          cleaned = cleaned.replace(attrRegex, '')
        })
      }
      
      return cleaned
    })
  }
}))

describe('sanitization utilities', () => {
  describe('sanitizeHTML', () => {
    it('should return empty string for falsy input', () => {
      expect(sanitizeHTML('')).toBe('')
      expect(sanitizeHTML(null as any)).toBe('')
      expect(sanitizeHTML(undefined as any)).toBe('')
    })

    it('should return empty string for non-string input', () => {
      expect(sanitizeHTML(123 as any)).toBe('')
      expect(sanitizeHTML({} as any)).toBe('')
      expect(sanitizeHTML([] as any)).toBe('')
    })

    it('should sanitize dangerous content', () => {
      expect(sanitizeHTML('<script>alert("xss")</script>')).toBe('')
      expect(sanitizeHTML('<img src="x">'))
        .toBe('<img src="x">')
    })

    it('should allow safe HTML tags by default', () => {
      const safeHTML = '<p>Hello <strong>world</strong></p>'
      expect(sanitizeHTML(safeHTML)).toBe(safeHTML)
    })

    it('should respect custom allowed tags', () => {
      const html = '<p>Hello <custom>world</custom></p>'
      const options = { allowedTags: ['p', 'custom'] }
      expect(sanitizeHTML(html, options)).toBe(html)
    })

    it('should handle style attributes based on options', () => {
      const html = '<p style="color: red;">Styled text</p>'
      
      // Without allowStyles (style should be removed)
      expect(sanitizeHTML(html)).toBe('<p>Styled text</p>')
      
      // With allowStyles
      expect(sanitizeHTML(html, { allowStyles: true })).toBe(html)
    })

    it('should handle custom protocols', () => {
      const html = '<a href="custom://app">Link</a>'
      const options = { allowedProtocols: ['custom'] }
      expect(sanitizeHTML(html, options)).toBe(html)
    })

    it('should apply tag transformations', () => {
      const html = '<b>Bold text</b>'
      const options = {
        transformTags: { 'b': 'strong' }
      }
      const result = sanitizeHTML(html, options)
      expect(result).toBe('<strong>Bold text</strong>')
    })

    it('should handle multiple tag transformations', () => {
      const html = '<b>Bold</b> and <i>italic</i>'
      const options = {
        transformTags: { 
          'b': 'strong',
          'i': 'em'
        }
      }
      const result = sanitizeHTML(html, options)
      expect(result).toBe('<strong>Bold</strong> and <em>italic</em>')
    })
  })

  describe('sanitizeForAttribute', () => {
    it('should return empty string for falsy input', () => {
      expect(sanitizeForAttribute('')).toBe('')
      expect(sanitizeForAttribute(null as any)).toBe('')
      expect(sanitizeForAttribute(undefined as any)).toBe('')
    })

    it('should return empty string for non-string input', () => {
      expect(sanitizeForAttribute(123 as any)).toBe('')
      expect(sanitizeForAttribute({} as any)).toBe('')
    })

    it('should escape HTML special characters', () => {
      expect(sanitizeForAttribute('&')).toBe('&amp;')
      expect(sanitizeForAttribute('<')).toBe('&lt;')
      expect(sanitizeForAttribute('>')).toBe('&gt;')
      expect(sanitizeForAttribute('"')).toBe('&quot;')
      expect(sanitizeForAttribute("'")).toBe('&#x27;')
      expect(sanitizeForAttribute('/')).toBe('&#x2F;')
    })

    it('should escape multiple characters', () => {
      expect(sanitizeForAttribute('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;')
    })

    it('should handle normal text', () => {
      expect(sanitizeForAttribute('Hello World')).toBe('Hello World')
      expect(sanitizeForAttribute('user@example.com')).toBe('user@example.com')
    })
  })

  describe('sanitizeForURL', () => {
    it('should return # for falsy input', () => {
      expect(sanitizeForURL('')).toBe('#')
      expect(sanitizeForURL(null as any)).toBe('#')
      expect(sanitizeForURL(undefined as any)).toBe('#')
    })

    it('should return # for non-string input', () => {
      expect(sanitizeForURL(123 as any)).toBe('#')
      expect(sanitizeForURL({} as any)).toBe('#')
    })

    it('should block dangerous protocols', () => {
      expect(sanitizeForURL('javascript:alert(1)')).toBe('#')
      expect(sanitizeForURL('vbscript:alert(1)')).toBe('#')
      expect(sanitizeForURL('file:///etc/passwd')).toBe('#')
      expect(sanitizeForURL('data:text/html,<script>alert(1)</script>')).toBe('#')
    })

    it('should allow safe protocols', () => {
      expect(sanitizeForURL('https://example.com')).toBe('https://example.com')
      expect(sanitizeForURL('http://example.com')).toBe('http://example.com')
      expect(sanitizeForURL('mailto:user@example.com')).toBe('mailto:user@example.com')
      expect(sanitizeForURL('tel:+1234567890')).toBe('tel:+1234567890')
      expect(sanitizeForURL('#section')).toBe('#section')
    })

    it('should handle whitespace in URLs', () => {
      expect(sanitizeForURL('  javascript:alert(1)  ')).toBe('#')
      expect(sanitizeForURL('java\nscript:alert(1)')).toBe('#')
      expect(sanitizeForURL('java\tscript:alert(1)')).toBe('#')
    })

    it('should allow safe data URLs when option is set', () => {
      const imageDataUrl = 'data:image/png;base64,iVBORw0KGgo='
      expect(sanitizeForURL(imageDataUrl, { allowDataUrls: true })).toBe(imageDataUrl)
      
      const jpegUrl = 'data:image/jpeg;base64,/9j/4AAQ='
      expect(sanitizeForURL(jpegUrl, { allowDataUrls: true })).toBe(jpegUrl)
    })

    it('should block non-image data URLs even with allowDataUrls', () => {
      const htmlDataUrl = 'data:text/html,<script>alert(1)</script>'
      expect(sanitizeForURL(htmlDataUrl, { allowDataUrls: true })).toBe('#')
    })

    it('should handle case insensitive protocols', () => {
      expect(sanitizeForURL('JAVASCRIPT:alert(1)')).toBe('#')
      expect(sanitizeForURL('JavaScript:alert(1)')).toBe('#')
      expect(sanitizeForURL('DATA:text/html,test')).toBe('#')
    })
  })

  describe('createSanitizer', () => {
    it('should create a function that uses provided options', () => {
      const sanitizer = createSanitizer({
        allowedTags: ['p', 'span'],
        allowStyles: true
      })
      
      expect(typeof sanitizer).toBe('function')
      
      const html = '<p style="color: red;">Test</p>'
      expect(sanitizer(html)).toBe(html)
    })

    it('should create reusable sanitizer with consistent options', () => {
      const sanitizer = createSanitizer({
        transformTags: { 'b': 'strong' }
      })
      
      expect(sanitizer('<b>Bold 1</b>')).toBe('<strong>Bold 1</strong>')
      expect(sanitizer('<b>Bold 2</b>')).toBe('<strong>Bold 2</strong>')
    })
  })

  describe('sanitizeForSCORM', () => {
    it('should allow SCORM-specific attributes', () => {
      const html = '<div data-scorm-element="test" data-scorm-id="123">Content</div>'
      expect(sanitizeForSCORM(html)).toBe(html)
    })

    it('should allow SCORM objective and interaction attributes', () => {
      const html = '<span data-scorm-objective="obj1" data-scorm-interaction="choice">Question</span>'
      expect(sanitizeForSCORM(html)).toBe(html)
    })

    it('should not allow inline styles', () => {
      const html = '<p style="color: red;">No styles in SCORM</p>'
      expect(sanitizeForSCORM(html)).toBe('<p>No styles in SCORM</p>')
    })

    it('should handle empty input', () => {
      expect(sanitizeForSCORM('')).toBe('')
    })

    it('should remove dangerous content', () => {
      expect(sanitizeForSCORM('<script>alert(1)</script>')).toBe('')
    })
  })

  describe('needsSanitization', () => {
    it('should return false for falsy input', () => {
      expect(needsSanitization('')).toBe(false)
      expect(needsSanitization(null as any)).toBe(false)
      expect(needsSanitization(undefined as any)).toBe(false)
    })

    it('should return false for non-string input', () => {
      expect(needsSanitization(123 as any)).toBe(false)
      expect(needsSanitization({} as any)).toBe(false)
    })

    it('should detect script tags', () => {
      expect(needsSanitization('<script>alert(1)</script>')).toBe(true)
      expect(needsSanitization('<SCRIPT>alert(1)</SCRIPT>')).toBe(true)
      expect(needsSanitization('<script src="evil.js"></script>')).toBe(true)
    })

    it('should detect event handlers', () => {
      expect(needsSanitization('<img onerror="alert(1)">')).toBe(true)
      expect(needsSanitization('<div onclick="alert(1)">')).toBe(true)
      expect(needsSanitization('<body onload="alert(1)">')).toBe(true)
    })

    it('should detect dangerous protocols', () => {
      expect(needsSanitization('<a href="javascript:alert(1)">Link</a>')).toBe(true)
      expect(needsSanitization('<a href="vbscript:alert(1)">Link</a>')).toBe(true)
    })

    it('should detect dangerous tags', () => {
      expect(needsSanitization('<iframe src="evil.com"></iframe>')).toBe(true)
      expect(needsSanitization('<object data="evil.swf"></object>')).toBe(true)
      expect(needsSanitization('<embed src="evil.swf">')).toBe(true)
      expect(needsSanitization('<link rel="stylesheet" href="evil.css">')).toBe(true)
      expect(needsSanitization('<meta http-equiv="refresh">')).toBe(true)
      expect(needsSanitization('<style>body { display: none; }</style>')).toBe(true)
    })

    it('should return false for safe content', () => {
      expect(needsSanitization('<p>Hello world</p>')).toBe(false)
      expect(needsSanitization('<strong>Bold text</strong>')).toBe(false)
      expect(needsSanitization('<a href="https://example.com">Link</a>')).toBe(false)
      expect(needsSanitization('Plain text content')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(needsSanitization('<IFRAME>')).toBe(true)
      expect(needsSanitization('JAVASCRIPT:alert(1)')).toBe(true)
      expect(needsSanitization('onClick="alert(1)"')).toBe(true)
    })
  })
})