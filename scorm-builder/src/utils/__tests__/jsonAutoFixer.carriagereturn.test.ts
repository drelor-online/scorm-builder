import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Carriage Return Handling', () => {
  it('should remove carriage returns from JSON', () => {
    const inputWithCR = '{\r\n  "test": "value with\rcarriage return"\r\n}'
    // Note: newlines within string values get escaped
    const expected = '{\n  "test": "value with\\ncarriage return"\n}'
    
    const result = smartAutoFixJSON(inputWithCR)
    expect(result).toBe(expected)
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.test).toBe('value with\ncarriage return')
  })
  
  it('should handle Windows line endings', () => {
    const windowsJSON = '{\r\n  "welcomePage": {\r\n    "narration": "Part 192 requires: documentation"\r\n  }\r\n}'
    const result = smartAutoFixJSON(windowsJSON)
    
    // Should not contain any \r characters
    expect(result).not.toContain('\r')
    expect(result).toContain('\n')
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.welcomePage.narration).toBe('Part 192 requires: documentation')
  })
  
  it('should remove control characters except tab and newline', () => {
    const inputWithControl = '{\n  "test": "value\x00with\x01control\x1Fchars",\n  "tab": "has\ttab"\n}'
    const result = smartAutoFixJSON(inputWithControl)
    
    // Should remove control chars and escape tab
    expect(result).not.toContain('\x00')
    expect(result).not.toContain('\x01')
    expect(result).not.toContain('\x1F')
    expect(result).toContain('\\t')  // Tab gets escaped in string values
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.test).toBe('valuewithcontrolchars')
    expect(parsed.tab).toBe('has\ttab')
  })
  
  it('should handle mixed line endings and colons', () => {
    const mixedInput = `{
  "narration": "Part 192 Subpart L requires:\r\nproper documentation",
  "content": "Time:\r10:30 AM"
}`
    
    const result = smartAutoFixJSON(mixedInput)
    
    // Should not contain \r
    expect(result).not.toContain('\r')
    
    // Should preserve colons in strings
    expect(result).toContain('requires:')
    expect(result).toContain('Time:')
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.narration).toContain('requires:')
    expect(parsed.content).toContain('Time:')
  })
})