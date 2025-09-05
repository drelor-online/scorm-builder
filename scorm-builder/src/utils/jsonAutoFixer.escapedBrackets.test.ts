import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from './jsonAutoFixer'

describe('JSON Auto-Fixer - All Invalid Escape Sequences', () => {
  it('should remove escaped brackets from JSON arrays', () => {
    const input = `{
      "imageKeywords": \\["pipeline safety intro", "gas pipeline overview"],
      "options": \\["True", "False"]
    }`

    const expected = `{
      "imageKeywords": ["pipeline safety intro", "gas pipeline overview"],
      "options": ["True", "False"]
    }`

    const result = smartAutoFixJSON(input)
    
    // Should remove the backslashes before brackets
    expect(result).not.toContain('\\[')
    expect(result).not.toContain('\\]')
    
    // Should be valid JSON after fix
    expect(() => JSON.parse(result)).not.toThrow()
    
    // Should contain the correct arrays
    const parsed = JSON.parse(result)
    expect(parsed.imageKeywords).toEqual(["pipeline safety intro", "gas pipeline overview"])
    expect(parsed.options).toEqual(["True", "False"])
  })

  it('should handle escaped brackets in complex nested structures', () => {
    const input = `{
      "topics": \\[
        {
          "knowledgeCheck": {
            "questions": \\[
              {
                "options": \\["True", "False"]
              }
            ]
          }
        }
      ]
    }`

    const result = smartAutoFixJSON(input)
    
    // Should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow()
    
    // Should not contain escaped brackets
    expect(result).not.toContain('\\[')
    expect(result).not.toContain('\\]')
  })

  it('should preserve valid arrays without backslashes', () => {
    const input = `{
      "imageKeywords": ["pipeline safety intro", "gas pipeline overview"],
      "options": ["True", "False"]
    }`

    const result = smartAutoFixJSON(input)
    
    // Should remain unchanged for valid JSON
    expect(() => JSON.parse(result)).not.toThrow()
    
    const parsed = JSON.parse(result)
    expect(parsed.imageKeywords).toEqual(["pipeline safety intro", "gas pipeline overview"])
    expect(parsed.options).toEqual(["True", "False"])
  })

  it('should handle user beta tester exact JSON structure', () => {
    // This is a simplified version of the actual problematic JSON
    const input = `{
      "welcomePage": {
        "imageKeywords": \\["pipeline safety intro", "gas pipeline overview"],
        "imagePrompts": \\["Clean infographic style image"],
        "videoSearchTerms": \\["49 CFR 192 introduction"]
      },
      "topics": \\[
        {
          "knowledgeCheck": {
            "questions": \\[
              {
                "options": \\["True", "False"]
              }
            ]
          }
        }
      ]
    }`

    const result = smartAutoFixJSON(input)
    
    // This test will FAIL initially, proving the issue exists
    expect(() => JSON.parse(result)).not.toThrow()
    expect(result).not.toContain('\\[')
    expect(result).not.toContain('\\]')
  })

  it('should remove invalid escape sequence \\& from strings like O\\&M', () => {
    const input = `{
      "title": "Operations \\& Maintenance",
      "department": "O\\&M",
      "description": "This covers O\\&M procedures"
    }`

    const result = smartAutoFixJSON(input)
    
    // Should be valid JSON after fix
    expect(() => JSON.parse(result)).not.toThrow()
    
    // Should not contain \\& anymore
    expect(result).not.toContain('\\&')
    
    // Should contain & instead
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe("Operations & Maintenance")
    expect(parsed.department).toBe("O&M")
    expect(parsed.description).toBe("This covers O&M procedures")
  })

  it('should remove all common invalid escape sequences', () => {
    const input = `{
      "text1": "Contains \\! exclamation",
      "text2": "Contains \\# hash",
      "text3": "Contains \\$ dollar",
      "text4": "Contains \\% percent",
      "text5": "Contains \\& ampersand",
      "text6": "Contains \\* asterisk",
      "text7": "Contains \\+ plus",
      "text8": "Contains \\< less than",
      "text9": "Contains \\> greater than",
      "text10": "Contains \\? question",
      "text11": "Contains \\@ at symbol",
      "arrays": \\["item1", "item2"]
    }`

    const result = smartAutoFixJSON(input)
    
    // Should be valid JSON after fix
    expect(() => JSON.parse(result)).not.toThrow()
    
    // Should not contain any invalid escapes
    expect(result).not.toContain('\\!')
    expect(result).not.toContain('\\#')
    expect(result).not.toContain('\\$')
    expect(result).not.toContain('\\%')
    expect(result).not.toContain('\\&')
    expect(result).not.toContain('\\*')
    expect(result).not.toContain('\\+')
    expect(result).not.toContain('\\<')
    expect(result).not.toContain('\\>')
    expect(result).not.toContain('\\?')
    expect(result).not.toContain('\\@')
    expect(result).not.toContain('\\[')
    expect(result).not.toContain('\\]')
    
    // Should contain the unescaped characters
    const parsed = JSON.parse(result)
    expect(parsed.text1).toBe("Contains ! exclamation")
    expect(parsed.text2).toBe("Contains # hash")
    expect(parsed.text3).toBe("Contains $ dollar")
    expect(parsed.text4).toBe("Contains % percent")
    expect(parsed.text5).toBe("Contains & ampersand")
    expect(parsed.text6).toBe("Contains * asterisk")
    expect(parsed.text7).toBe("Contains + plus")
    expect(parsed.text8).toBe("Contains < less than")
    expect(parsed.text9).toBe("Contains > greater than")
    expect(parsed.text10).toBe("Contains ? question")
    expect(parsed.text11).toBe("Contains @ at symbol")
    expect(parsed.arrays).toEqual(["item1", "item2"])
  })

  it('should preserve valid JSON escape sequences', () => {
    const input = `{
      "quote": "He said \\"Hello world\\"",
      "newline": "Line 1\\nLine 2",
      "tab": "Column 1\\tColumn 2",
      "unicode": "Unicode: \\u0041",
      "carriageReturn": "Text\\r\\n",
      "formFeed": "Page break\\f"
    }`

    const result = smartAutoFixJSON(input)
    
    // Should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow()
    
    // Should preserve all valid escapes  
    expect(result).toContain('\\"')
    expect(result).toContain('\\n')
    expect(result).toContain('\\t')
    expect(result).toContain('\\u0041')
    expect(result).toContain('\\r')
    expect(result).toContain('\\f')
    
    const parsed = JSON.parse(result)
    expect(parsed.quote).toBe('He said "Hello world"')
    expect(parsed.newline).toBe('Line 1\nLine 2')
    expect(parsed.tab).toBe('Column 1\tColumn 2')
    expect(parsed.unicode).toBe('Unicode: A')  // \u0041 is 'A'
  })

  it('should handle mixed valid and invalid escape sequences', () => {
    const input = `{
      "mixed": "Valid quote \\" but invalid \\& and \\% symbols",
      "arrays": \\["item with \\n newline", "item with \\& ampersand"]
    }`

    const result = smartAutoFixJSON(input)
    
    // Should be valid JSON after fix
    expect(() => JSON.parse(result)).not.toThrow()
    
    // Should preserve valid escapes but remove invalid ones
    expect(result).toContain('\\"')  // valid quote escape preserved
    expect(result).toContain('\\n')  // valid newline escape preserved
    expect(result).not.toContain('\\&')  // invalid & escape removed
    expect(result).not.toContain('\\%')  // invalid % escape removed
    expect(result).not.toContain('\\[')  // invalid bracket escape removed
    
    const parsed = JSON.parse(result)
    expect(parsed.mixed).toBe('Valid quote " but invalid & and % symbols')
    expect(parsed.arrays).toEqual(["item with \n newline", "item with & ampersand"])
  })
})