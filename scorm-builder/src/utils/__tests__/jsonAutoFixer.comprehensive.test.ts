import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Comprehensive Test Suite', () => {
  describe('Quote and Colon Handling', () => {
    it('should not treat colons in string values as JSON delimiters', () => {
      const buggyJSON = `{
  "narration": "The rule states: "Always follow procedures" and requires: proper documentation"
}`

      const fixed = smartAutoFixJSON(buggyJSON)
      
      let parsed: any
      expect(() => {
        parsed = JSON.parse(fixed)
      }).not.toThrow()
      
      expect(parsed.narration).toContain('The rule states:')
      expect(parsed.narration).toContain('and requires:')
    })

    it('should handle colons appearing after quotes in values', () => {
      const trickyJSON = `{
  "field": "Value with "quote" then: more text"
}`
      
      const fixed = smartAutoFixJSON(trickyJSON)
      expect(() => JSON.parse(fixed)).not.toThrow()
    })

    it('should fix unescaped quotes in JSON strings', () => {
      const unescapedJSON = `{
  "title": "Course "Advanced Topics" Module",
  "description": "Learn the "hard" concepts"
}`

      const fixed = smartAutoFixJSON(unescapedJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed.title).toContain('Advanced Topics')
      expect(parsed.description).toContain('hard')
    })
  })

  describe('Carriage Return and Line Handling', () => {
    it('should handle carriage returns in JSON content', () => {
      const crJSON = `{
  "content": "Line 1\r\nLine 2\r\nLine 3"
}`

      const fixed = smartAutoFixJSON(crJSON)
      expect(() => JSON.parse(fixed)).not.toThrow()
    })

    it('should preserve intentional line breaks in content', () => {
      const multilineJSON = `{
  "narration": "First paragraph.\\n\\nSecond paragraph with proper breaks."
}`

      const fixed = smartAutoFixJSON(multilineJSON)
      const parsed = JSON.parse(fixed)
      expect(parsed.narration).toContain('\\n\\n')
    })
  })

  describe('Null and Empty Value Handling', () => {
    it('should handle null values properly', () => {
      const nullJSON = `{
  "optionalField": null,
  "emptyString": "",
  "normalField": "value"
}`

      const fixed = smartAutoFixJSON(nullJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed.optionalField).toBeNull()
      expect(parsed.emptyString).toBe('')
      expect(parsed.normalField).toBe('value')
    })

    it('should handle undefined as string conversion', () => {
      const undefinedJSON = `{
  "field": undefined
}`

      const fixed = smartAutoFixJSON(undefinedJSON)
      const parsed = JSON.parse(fixed)
      expect(parsed.field).toBeDefined()
    })
  })

  describe('Real-World Complex Cases', () => {
    it('should fix complex JSON with multiple issues', () => {
      const complexJSON = `{
  "welcomePage": {
    "title": "Welcome to 49 CFR Part 192: "Gas Pipeline Safety Standards"",
    "content": "Complex content with: colons and "quotes" mixed together",
    "narration": "Hello and welcome. This course covers Title 49: regulations that govern pipeline safety."
  }
}`

      const fixed = smartAutoFixJSON(complexJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed.welcomePage.title).toContain('Gas Pipeline Safety Standards')
      expect(parsed.welcomePage.content).toContain('colons and')
      expect(parsed.welcomePage.content).toContain('quotes')
      expect(parsed.welcomePage.narration).toContain('Title 49:')
    })

    it('should handle SCORM course data with mixed formatting', () => {
      const scormJSON = `{
  "pages": [
    {
      "id": "page-1",
      "title": "Introduction to "Best Practices"",
      "content": "Key points: safety first, proper documentation, and "team communication""
    }
  ]
}`

      const fixed = smartAutoFixJSON(scormJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed.pages).toHaveLength(1)
      expect(parsed.pages[0].title).toContain('Best Practices')
      expect(parsed.pages[0].content).toContain('safety first')
      expect(parsed.pages[0].content).toContain('team communication')
    })
  })

  describe('User Input Edge Cases', () => {
    it('should handle JSON from user copy-paste operations', () => {
      const userJSON = `{
  "userInput": "Text that might contain "smart quotes" or other: problematic characters"
}`

      const fixed = smartAutoFixJSON(userJSON)
      expect(() => JSON.parse(fixed)).not.toThrow()
    })

    it('should handle JSON with mixed quote styles', () => {
      const mixedQuotesJSON = `{
  "field1": "Regular quotes",
  "field2": "Smart quotes" from copy-paste",
  "field3": "Mixed: "quoted" content"
}`

      const fixed = smartAutoFixJSON(mixedQuotesJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed.field1).toBe('Regular quotes')
      expect(parsed.field2).toContain('Smart quotes')
      expect(parsed.field3).toContain('quoted')
    })
  })

  describe('Performance and Robustness', () => {
    it('should handle large JSON content efficiently', () => {
      const largeContent = 'A'.repeat(10000)
      const largeJSON = `{
  "largeField": "${largeContent} with "quotes" and: colons"
}`

      const fixed = smartAutoFixJSON(largeJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed.largeField).toContain(largeContent)
      expect(parsed.largeField).toContain('quotes')
    })

    it('should not break valid JSON', () => {
      const validJSON = `{
  "field": "Valid content without issues",
  "number": 123,
  "boolean": true,
  "array": ["item1", "item2"]
}`

      const fixed = smartAutoFixJSON(validJSON)
      const original = JSON.parse(validJSON)
      const parsed = JSON.parse(fixed)
      
      expect(parsed).toEqual(original)
    })
  })
})