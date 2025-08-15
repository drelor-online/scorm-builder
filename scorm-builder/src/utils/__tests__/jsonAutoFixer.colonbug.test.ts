import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Colon Bug Reproduction', () => {
  it('should not treat colons in string values as JSON delimiters', () => {
    // This JSON has unescaped quotes that need fixing
    // AND has colons that should NOT be treated as JSON structure
    const buggyJSON = `{
  "narration": "The rule states: "Always follow procedures" and requires: proper documentation"
}`

    const fixed = smartAutoFixJSON(buggyJSON)
    console.log('Fixed JSON:', fixed)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // The narration should have both colons preserved
    expect(parsed.narration).toContain('The rule states:')
    expect(parsed.narration).toContain('and requires:')
  })

  it('should handle colons appearing after the first quote in a value', () => {
    // This tests if the function incorrectly finds ':"' pattern within the value
    const trickyJSON = `{
  "field": "Value with "quote" then: more text"
}`

    const fixed = smartAutoFixJSON(trickyJSON)
    console.log('Fixed tricky JSON:', fixed)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.field).toContain('then:')
  })

  it('should handle the line-by-line processing issue with colons', () => {
    // The current implementation processes line by line and looks for ':"'
    // This can cause issues when a value spans multiple lines or contains ':"'
    const multilineJSON = `{
  "description": "This is line one with a colon: important info",
  "details": "Another field that says: "quoted text" here"
}`

    const fixed = smartAutoFixJSON(multilineJSON)
    console.log('Fixed multiline:', fixed)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.description).toBe('This is line one with a colon: important info')
    expect(parsed.details).toContain('Another field that says:')
  })

  it('should not incorrectly identify ": pattern within string values', () => {
    // The bug happens when '":' appears within a string value
    const patternJSON = `{
  "text": "He said": this is wrong" and continued"
}`

    const fixed = smartAutoFixJSON(patternJSON)
    console.log('Pattern fix:', fixed)
    
    // Should handle this edge case
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
  })
})