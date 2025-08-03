import { describe, it, expect, vi } from 'vitest'
import { sanitizeContent, sanitizeContentItem } from '../contentSanitizer'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((content, config) => {
      // Simple mock implementation that removes script tags
      if (content === null || content === undefined) {
        return String(content)
      }
      let sanitized = content
      
      // Remove forbidden tags
      if (config?.FORBID_TAGS) {
        config.FORBID_TAGS.forEach((tag: string) => {
          const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi')
          sanitized = sanitized.replace(regex, '')
          // Also remove self-closing tags
          const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi')
          sanitized = sanitized.replace(selfClosingRegex, '')
        })
      }
      
      // Remove forbidden attributes
      if (config?.FORBID_ATTR) {
        config.FORBID_ATTR.forEach((attr: string) => {
          const regex = new RegExp(`\\s${attr}="[^"]*"`, 'gi')
          sanitized = sanitized.replace(regex, '')
        })
      }
      
      return sanitized
    })
  }
}))

describe('contentSanitizer', () => {
  describe('sanitizeContent', () => {
    it('should allow safe HTML tags', () => {
      const safeContent = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>'
      const result = sanitizeContent(safeContent)
      expect(result).toBe(safeContent)
    })

    it('should remove script tags', () => {
      const unsafeContent = '<p>Hello</p><script>alert("XSS")</script><p>World</p>'
      const result = sanitizeContent(unsafeContent)
      expect(result).toBe('<p>Hello</p><p>World</p>')
    })

    it('should remove iframe tags', () => {
      const unsafeContent = '<p>Content</p><iframe src="evil.com"></iframe>'
      const result = sanitizeContent(unsafeContent)
      expect(result).toBe('<p>Content</p>')
    })

    it('should remove event handlers', () => {
      const unsafeContent = '<p onclick="alert(\'XSS\')">Click me</p>'
      const result = sanitizeContent(unsafeContent)
      expect(result).toBe('<p>Click me</p>')
    })

    it('should allow safe attributes', () => {
      const safeContent = '<a href="https://example.com" title="Example">Link</a>'
      const result = sanitizeContent(safeContent)
      expect(result).toBe(safeContent)
    })

    it('should handle empty content', () => {
      expect(sanitizeContent('')).toBe('')
    })

    it('should handle null-like content', () => {
      // DOMPurify handles null/undefined by converting to string
      const nullResult = sanitizeContent(null as any)
      expect(typeof nullResult).toBe('string')
      
      const undefinedResult = sanitizeContent(undefined as any)
      expect(typeof undefinedResult).toBe('string')
    })

    it('should preserve allowed image tags with attributes', () => {
      const content = '<img src="image.jpg" alt="Description" width="100" height="100">'
      const result = sanitizeContent(content)
      expect(result).toBe(content)
    })

    it('should preserve table structure', () => {
      const tableContent = `
        <table>
          <thead>
            <tr><th>Header 1</th><th>Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </tbody>
        </table>
      `
      const result = sanitizeContent(tableContent)
      expect(result).toBe(tableContent)
    })

    it('should handle mixed safe and unsafe content', () => {
      const mixedContent = `
        <div class="container">
          <h1>Title</h1>
          <script>alert('XSS')</script>
          <p>Safe paragraph</p>
          <iframe src="evil.com"></iframe>
          <a href="#" onclick="alert('XSS')">Link</a>
        </div>
      `
      const result = sanitizeContent(mixedContent)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<iframe>')
      expect(result).not.toContain('onclick=')
      expect(result).toContain('<h1>Title</h1>')
      expect(result).toContain('<p>Safe paragraph</p>')
    })
  })

  describe('sanitizeContentItem', () => {
    it('should sanitize content property', () => {
      const item = {
        id: '1',
        content: '<p>Hello</p><script>alert("XSS")</script>',
        title: 'Test Item'
      }
      
      const result = sanitizeContentItem(item)
      expect(result.content).toBe('<p>Hello</p>')
      expect(result.id).toBe('1')
      expect(result.title).toBe('Test Item')
    })

    it('should sanitize narration property', () => {
      const item = {
        id: '1',
        narration: '<p>Narration</p><script>alert("XSS")</script>',
        title: 'Test Item'
      }
      
      const result = sanitizeContentItem(item)
      expect(result.narration).toBe('<p>Narration</p>')
    })

    it('should handle items without content or narration', () => {
      const item = {
        id: '1',
        title: 'Test Item',
        description: 'Some description'
      }
      
      const result = sanitizeContentItem(item)
      expect(result).toEqual(item)
    })

    it('should handle null/undefined items', () => {
      expect(sanitizeContentItem(null)).toBe(null)
      expect(sanitizeContentItem(undefined)).toBe(undefined)
    })

    it('should preserve other properties', () => {
      const item = {
        id: '1',
        content: '<p>Content</p>',
        narration: '<p>Narration</p>',
        metadata: { author: 'Test', date: '2024-01-01' },
        tags: ['tag1', 'tag2']
      }
      
      const result = sanitizeContentItem(item)
      expect(result.metadata).toEqual(item.metadata)
      expect(result.tags).toEqual(item.tags)
    })

    it('should handle empty content and narration', () => {
      const item = {
        id: '1',
        content: '',
        narration: ''
      }
      
      const result = sanitizeContentItem(item)
      expect(result.content).toBe('')
      expect(result.narration).toBe('')
    })

    it('should not modify the original item', () => {
      const item = {
        id: '1',
        content: '<p>Original</p>',
        narration: '<p>Original narration</p>'
      }
      
      const originalCopy = { ...item }
      sanitizeContentItem(item)
      
      expect(item).toEqual(originalCopy)
    })
  })
})