import { describe, it, expect } from 'vitest'
import { 
  sanitizeHTML, 
  sanitizeForAttribute, 
  sanitizeForURL,
  createSanitizer
} from './sanitization'

describe('Sanitization Utilities', () => {
  describe('sanitizeHTML', () => {
    it('should remove script tags', () => {
      const dirty = '<p>Hello</p><script>alert("XSS")</script><p>World</p>'
      const clean = sanitizeHTML(dirty)
      expect(clean).toBe('<p>Hello</p><p>World</p>')
      expect(clean).not.toContain('<script>')
    })

    it('should remove event handlers', () => {
      const dirty = '<button onclick="alert(\'XSS\')">Click me</button>'
      const clean = sanitizeHTML(dirty)
      expect(clean).toBe('<button>Click me</button>')
      expect(clean).not.toContain('onclick')
    })

    it('should allow safe HTML tags', () => {
      const safe = '<p>Hello <strong>world</strong> <em>today</em></p>'
      const clean = sanitizeHTML(safe)
      expect(clean).toBe(safe)
    })

    it('should handle img tags safely', () => {
      const dirty = '<img src="javascript:alert(\'XSS\')" onerror="alert(\'XSS\')">'
      const clean = sanitizeHTML(dirty)
      expect(clean).not.toContain('javascript:')
      expect(clean).not.toContain('onerror')
    })

    it('should preserve allowed attributes', () => {
      const html = '<a href="https://example.com" target="_blank">Link</a>'
      const clean = sanitizeHTML(html)
      expect(clean).toContain('href="https://example.com"')
      expect(clean).toContain('target="_blank"')
    })

    it('should handle null and undefined gracefully', () => {
      expect(sanitizeHTML(null as any)).toBe('')
      expect(sanitizeHTML(undefined as any)).toBe('')
    })

    it('should handle empty strings', () => {
      expect(sanitizeHTML('')).toBe('')
    })

    it('should strip dangerous protocols from links', () => {
      const dirty = '<a href="javascript:void(0)">Click</a>'
      const clean = sanitizeHTML(dirty)
      expect(clean).not.toContain('javascript:')
    })

    it('should allow data URIs for images', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANS'
      const html = `<img src="${dataUri}" alt="Test">`
      const clean = sanitizeHTML(html)
      expect(clean).toContain('data:image/png')
    })

    it('should remove style tags by default', () => {
      const dirty = '<style>body { display: none; }</style><p>Content</p>'
      const clean = sanitizeHTML(dirty)
      expect(clean).toBe('<p>Content</p>')
      expect(clean).not.toContain('<style>')
    })
  })

  describe('sanitizeForAttribute', () => {
    it('should escape quotes', () => {
      const input = 'Hello "World" and \'Universe\''
      const escaped = sanitizeForAttribute(input)
      expect(escaped).toBe('Hello &quot;World&quot; and &#x27;Universe&#x27;')
    })

    it('should escape HTML entities', () => {
      const input = '<script>alert("XSS")</script>'
      const escaped = sanitizeForAttribute(input)
      expect(escaped).not.toContain('<')
      expect(escaped).not.toContain('>')
    })

    it('should handle special characters', () => {
      const input = '& < > " \' /'
      const escaped = sanitizeForAttribute(input)
      expect(escaped).toBe('&amp; &lt; &gt; &quot; &#x27; &#x2F;')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeForAttribute(null as any)).toBe('')
      expect(sanitizeForAttribute(undefined as any)).toBe('')
    })
  })

  describe('sanitizeForURL', () => {
    it('should allow safe URLs', () => {
      const urls = [
        'https://example.com',
        'http://example.com',
        '/relative/path',
        'path/to/resource',
        '#anchor'
      ]
      
      urls.forEach(url => {
        expect(sanitizeForURL(url)).toBe(url)
      })
    })

    it('should block dangerous protocols', () => {
      const dangerous = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        'file:///etc/passwd'
      ]
      
      dangerous.forEach(url => {
        expect(sanitizeForURL(url)).toBe('#')
      })
    })

    it('should allow data URIs for specific types', () => {
      const allowedDataUris = [
        'data:image/png;base64,iVBORw0KGgoAAAANS',
        'data:image/jpeg;base64,/9j/4AAQSkZJRg',
        'data:image/gif;base64,R0lGODlhAQABAAAA',
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz',
        'data:image/webp;base64,UklGRiQAAABXRUJQ'
      ]
      
      allowedDataUris.forEach(url => {
        expect(sanitizeForURL(url, { allowDataUrls: true })).toBe(url)
      })
    })

    it('should block non-image data URIs', () => {
      const url = 'data:text/html,<script>alert("XSS")</script>'
      expect(sanitizeForURL(url, { allowDataUrls: true })).toBe('#')
    })

    it('should handle malformed URLs', () => {
      const malformed = [
        'javascript:',
        'java\nscript:alert("XSS")',
        'java\tscript:alert("XSS")',
        '   javascript:alert("XSS")'
      ]
      
      malformed.forEach(url => {
        expect(sanitizeForURL(url)).toBe('#')
      })
    })

    it('should handle null and undefined', () => {
      expect(sanitizeForURL(null as any)).toBe('#')
      expect(sanitizeForURL(undefined as any)).toBe('#')
    })
  })

  describe('createSanitizer', () => {
    it('should create custom sanitizer with options', () => {
      const sanitizer = createSanitizer({
        allowedTags: ['p', 'span'],
        allowedAttributes: {
          'p': ['class'],
          'span': ['id']
        }
      })
      
      const html = '<p class="test"><span id="s1">Text</span><div>Removed</div></p>'
      const clean = sanitizer(html)
      expect(clean).toContain('<p class="test">')
      expect(clean).toContain('<span id="s1">')
      expect(clean).not.toContain('<div>')
    })

    it('should allow styles when specified', () => {
      const sanitizer = createSanitizer({
        allowStyles: true
      })
      
      const html = '<p style="color: red;">Red text</p>'
      const clean = sanitizer(html)
      expect(clean).toContain('style="color: red;"')
    })

    it('should strip styles by default', () => {
      const sanitizer = createSanitizer({})
      const html = '<p style="color: red;">Red text</p>'
      const clean = sanitizer(html)
      expect(clean).not.toContain('style=')
    })

    it('should allow additional protocols', () => {
      const sanitizer = createSanitizer({
        allowedProtocols: ['tel', 'mailto']
      })
      
      const html = '<a href="tel:+1234567890">Call</a><a href="mailto:test@example.com">Email</a>'
      const clean = sanitizer(html)
      expect(clean).toContain('href="tel:+1234567890"')
      expect(clean).toContain('href="mailto:test@example.com"')
    })

    it('should handle custom tag transformations', () => {
      const sanitizer = createSanitizer({
        transformTags: {
          'b': 'strong',
          'i': 'em'
        }
      })
      
      const html = '<b>Bold</b> and <i>italic</i>'
      const clean = sanitizer(html)
      expect(clean).toBe('<strong>Bold</strong> and <em>italic</em>')
    })
  })

  describe('SCORM-specific sanitization', () => {
    it('should preserve SCORM-specific attributes', () => {
      const html = '<div data-scorm-element="navigation" data-scorm-id="nav1">Nav</div>'
      const clean = sanitizeHTML(html, { 
        allowedAttributes: {
          div: ['data-scorm-element', 'data-scorm-id']
        }
      })
      expect(clean).toContain('data-scorm-element="navigation"')
      expect(clean).toContain('data-scorm-id="nav1"')
    })

    it('should sanitize SCORM content while preserving structure', () => {
      const scormContent = `
        <div class="scorm-content">
          <h1>Title</h1>
          <p>Content with <script>alert("XSS")</script> removed</p>
          <img src="image.jpg" alt="Test" onerror="alert('XSS')">
        </div>
      `
      const clean = sanitizeHTML(scormContent)
      expect(clean).toContain('<h1>Title</h1>')
      expect(clean).toContain('<p>Content with  removed</p>')
      expect(clean).toContain('<img src="image.jpg" alt="Test">')
      expect(clean).not.toContain('onerror')
      expect(clean).not.toContain('<script>')
    })
  })
})