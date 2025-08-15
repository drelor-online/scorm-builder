import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Null Value Handling', () => {
  it('should convert null narration to empty string', () => {
    const inputWithNull = `{
  "assessment": {
    "passMark": 80,
    "narration": null
  }
}`
    
    const result = smartAutoFixJSON(inputWithNull)
    
    // Should convert null to empty string
    expect(result).toContain('"narration": ""')
    expect(result).not.toContain('null')
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.assessment.narration).toBe('')
  })
  
  it('should handle multiple null string fields', () => {
    const inputWithNulls = `{
  "welcomePage": {
    "title": "Welcome",
    "content": null,
    "narration": null
  },
  "topics": [{
    "title": null,
    "description": null,
    "narration": null
  }]
}`
    
    const result = smartAutoFixJSON(inputWithNulls)
    
    // Should convert all null string fields to empty strings
    expect(result).not.toContain('null')
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.welcomePage.content).toBe('')
    expect(parsed.welcomePage.narration).toBe('')
    expect(parsed.topics[0].title).toBe('')
    expect(parsed.topics[0].description).toBe('')
    expect(parsed.topics[0].narration).toBe('')
  })
  
  it('should preserve non-string null values', () => {
    const inputWithMixedNulls = `{
  "narration": null,
  "someNumber": null,
  "someBoolean": null,
  "content": null
}`
    
    const result = smartAutoFixJSON(inputWithMixedNulls)
    
    // Should only fix known string fields
    expect(result).toContain('"narration": ""')
    expect(result).toContain('"content": ""')
    // Other nulls should remain
    expect(result).toContain('"someNumber": null')
    expect(result).toContain('"someBoolean": null')
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.narration).toBe('')
    expect(parsed.content).toBe('')
    expect(parsed.someNumber).toBe(null)
    expect(parsed.someBoolean).toBe(null)
  })
  
  it('should handle real-world assessment JSON with null narration', () => {
    const realWorldJSON = `{
  "assessment": {
    "questions": [
      {
        "type": "multiple-choice",
        "question": "What is the requirement?",
        "correctAnswer": "For the life of the pipeline",
        "feedback": {
          "correct": "Correct!",
          "incorrect": "Incorrect."
        }
      }
    ],
    "passMark": 80,
    "narration": null
  }
}`
    
    const result = smartAutoFixJSON(realWorldJSON)
    
    // Should fix the null narration
    expect(result).toContain('"narration": ""')
    expect(result).not.toContain('"narration": null')
    
    // Should be valid JSON
    const parsed = JSON.parse(result)
    expect(parsed.assessment.narration).toBe('')
    expect(parsed.assessment.passMark).toBe(80)
    expect(parsed.assessment.questions[0].correctAnswer).toBe('For the life of the pipeline')
  })
})