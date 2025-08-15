import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Colon Handling in String Values', () => {
  it('should handle colons within string values without breaking', () => {
    // This test reproduces the exact issue reported by the user
    const jsonWithColonInString = `{
  "content": "Part 192 Subpart L requires: proper documentation and testing",
  "narration": "The regulation states: all pipelines must be tested"
}`

    const fixed = smartAutoFixJSON(jsonWithColonInString)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Content should be preserved exactly
    expect(parsed.content).toBe("Part 192 Subpart L requires: proper documentation and testing")
    expect(parsed.narration).toBe("The regulation states: all pipelines must be tested")
  })

  it('should handle multiple colons in the same string value', () => {
    const jsonWithMultipleColons = `{
  "title": "Requirements: Part 1: Section A: Overview",
  "description": "Time: 10:30 AM - Location: Building A: Room 203"
}`

    const fixed = smartAutoFixJSON(jsonWithMultipleColons)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.title).toBe("Requirements: Part 1: Section A: Overview")
    expect(parsed.description).toBe("Time: 10:30 AM - Location: Building A: Room 203")
  })

  it('should handle colons with unescaped quotes in the same string', () => {
    const complexJson = `{
  "content": "The instructor said: "Always follow Part 192: it's essential""
}`

    const fixed = smartAutoFixJSON(complexJson)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Quotes should be escaped but colons preserved
    expect(parsed.content).toContain("The instructor said:")
    expect(parsed.content).toContain("Part 192:")
  })

  it('should handle line 334 scenario - colon at end of sentence in narration', () => {
    // Simulating the exact scenario from line 334
    const line334Scenario = `{
  "topics": [{
    "id": "topic-5",
    "title": "Pipeline Requirements",
    "content": "<p>The regulations require:</p><ul><li>Testing</li><li>Documentation</li></ul>",
    "narration": "Part 192 Subpart L requires: First, all new pipelines must undergo hydrostatic testing. Second, the test pressure must exceed the maximum operating pressure by at least 25 percent. Third, the test must be maintained for a minimum of 8 hours. These requirements ensure that the pipeline can safely handle its intended operating conditions."
  }]
}`

    const fixed = smartAutoFixJSON(line334Scenario)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Check that the narration is preserved correctly
    expect(parsed.topics[0].narration).toContain("Part 192 Subpart L requires:")
    expect(parsed.topics[0].narration).toContain("First, all new pipelines")
  })

  it('should handle HTML content with colons and classes', () => {
    const htmlWithColons = `{
  "content": "<div class=\\"notice\\">Notice: The following applies:</div><p>Rule 1: Always test</p>"
}`

    const fixed = smartAutoFixJSON(htmlWithColons)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.content).toContain("Notice: The following applies:")
    expect(parsed.content).toContain("Rule 1: Always test")
  })

  it('should handle JSON structure colons vs content colons correctly', () => {
    const mixedColons = `{
  "instructions": "Step 1: Open the file. Step 2: Edit the content.",
  "nested": {
    "rule": "Rule: Always backup before editing",
    "time": "Meeting: 3:00 PM"
  }
}`

    const fixed = smartAutoFixJSON(mixedColons)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.instructions).toBe("Step 1: Open the file. Step 2: Edit the content.")
    expect(parsed.nested.rule).toBe("Rule: Always backup before editing")
    expect(parsed.nested.time).toBe("Meeting: 3:00 PM")
  })

  it('should handle array values with colons', () => {
    const arrayWithColons = `{
  "rules": [
    "Rule 1: Always test",
    "Rule 2: Document everything",
    "Rule 3: Follow guidelines"
  ],
  "times": ["9:00 AM", "12:00 PM", "3:00 PM"]
}`

    const fixed = smartAutoFixJSON(arrayWithColons)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.rules[0]).toBe("Rule 1: Always test")
    expect(parsed.times[0]).toBe("9:00 AM")
  })
})