import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Line 334 Specific Issue', () => {
  it('should handle the exact problematic JSON structure from line 334', () => {
    // This is the exact pattern that was breaking - multiline JSON with colons
    const problematicJSON = `{
  "topics": [
    {
      "id": "topic-10",
      "title": "Recordkeeping and Reporting",
      "content": "<h2>Documentation Requirements Under Part 192</h2><p>Part 192 Subpart M establishes comprehensive recordkeeping requirements. Operators must maintain records that demonstrate compliance with all applicable regulations. This includes design records, construction records, testing documentation, inspection reports, maintenance histories, and incident investigations.</p><p>Key recordkeeping principles include:</p><ul><li>Records must be maintained for the useful life of the pipeline</li><li>Certain records must be readily available at locations where activities are performed</li><li>Electronic recordkeeping is permitted if records are accessible and reproducible</li><li>Records must be made available to PHMSA upon request</li></ul><p>Specific retention periods vary. For example, pressure test records must be maintained for the life of the pipeline, while routine patrol records need only be kept for 5 years. Understanding these requirements is essential for compliance.</p>",
      "narration": "Part 192 Subpart L requires: proper documentation of all pipeline activities. This includes maintaining comprehensive records that demonstrate regulatory compliance. Records must cover the entire lifecycle of the pipeline, from initial design and construction through operation, maintenance, and eventual retirement. Different types of records have different retention requirements. Some, like pressure test records and material specifications, must be kept for the life of the pipeline. Others, such as routine patrol records, have shorter retention periods of 5 years. The regulations also specify where records must be maintained. Certain operational records must be readily available at locations where work is performed, while others can be maintained at central offices. Electronic recordkeeping is explicitly permitted, provided the records are accessible and can be reproduced when needed. Operators must also be prepared to make records available to PHMSA inspectors upon request. This transparency is a fundamental aspect of the regulatory framework, allowing PHMSA to verify compliance and identify potential safety issues. Proper recordkeeping isn't just about regulatory compliance – it's an essential tool for managing pipeline safety. Good records help operators track the condition of their systems, identify trends, and make informed decisions about maintenance and replacement. They also provide critical information during emergency response and incident investigations. Remember, if it's not documented, from a regulatory perspective, it didn't happen.",
      "imageKeywords": ["pipeline records", "documentation", "filing system", "inspector reviewing documents"],
      "imagePrompts": ["A well-organized filing system with pipeline documentation and records", "An inspector reviewing pipeline maintenance records and compliance documents"],
      "videoSearchTerms": ["pipeline recordkeeping requirements", "PHMSA documentation compliance", "gas pipeline records management"],
      "duration": 8
    }
  ]
}`

    // The issue is that when there's a colon in the narration like "Part 192 Subpart L requires:"
    // the function might incorrectly interpret this as a JSON structure delimiter
    const fixed = smartAutoFixJSON(problematicJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Check that the critical text with colon is preserved
    expect(parsed.topics[0].narration).toContain("Part 192 Subpart L requires:")
    // Em dash is converted to regular dash as part of smart quote fixes
    expect(parsed.topics[0].narration).toContain("compliance - it's an essential tool")
    expect(parsed.topics[0].content).toContain("Key recordkeeping principles include:")
  })

  it('should handle unescaped quotes AND colons in the same multiline string', () => {
    // This combines both issues - unescaped quotes and colons
    const complexJSON = `{
  "topics": [
    {
      "narration": "The instructor said: "Part 192 requires: complete documentation". This isn't optional – it's mandatory. The regulation states: all records must be maintained.",
      "content": "<p>Requirements: The operator must maintain "complete" records as stated in: Part 192.</p>"
    }
  ]
}`

    const fixed = smartAutoFixJSON(complexJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Check that colons are preserved and quotes are escaped
    expect(parsed.topics[0].narration).toContain("The instructor said:")
    expect(parsed.topics[0].narration).toContain("Part 192 requires:")
    expect(parsed.topics[0].narration).toContain("The regulation states:")
    expect(parsed.topics[0].content).toContain("Requirements:")
    expect(parsed.topics[0].content).toContain("as stated in:")
  })

  it('should handle extremely long strings with multiple colons and quotes', () => {
    // Simulating a very long narration field like the user has
    const longNarration = `Part 192 Subpart L requires: proper documentation. Section A states: "All records must be maintained". 
    The inspector noted: compliance is mandatory. Time: 10:30 AM. Location: Pipeline Station A. 
    Additional requirements: Complete testing by 5:00 PM. The supervisor said: "Don't forget: safety first!"
    Rule 1: Always document. Rule 2: Never skip inspections. Final note: This isn't optional.`

    const longJSON = `{
  "narration": "${longNarration.replace(/\n/g, ' ').replace(/\s+/g, ' ')}",
  "additionalNotes": "Meeting: 3:00 PM - Topic: Compliance Review"
}`

    const fixed = smartAutoFixJSON(longJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Verify all colons are preserved
    expect(parsed.narration).toContain("Part 192 Subpart L requires:")
    expect(parsed.narration).toContain("Section A states:")
    expect(parsed.narration).toContain("The inspector noted:")
    expect(parsed.narration).toContain("Time: 10:30 AM")
    expect(parsed.narration).toContain("Location: Pipeline Station A")
    expect(parsed.additionalNotes).toContain("Meeting: 3:00 PM")
  })

  it('should not break when colon appears at various positions in the string', () => {
    const edgeCases = `{
  "case1": ": colon at start",
  "case2": "colon at end:",
  "case3": "multiple:colons:in:middle",
  "case4": "quote and colon: "test"",
  "case5": ":",
  "case6": "normal text : spaced colon : more text"
}`

    const fixed = smartAutoFixJSON(edgeCases)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    expect(parsed.case1).toBe(": colon at start")
    expect(parsed.case2).toBe("colon at end:")
    expect(parsed.case3).toBe("multiple:colons:in:middle")
    expect(parsed.case5).toBe(":")
    expect(parsed.case6).toBe("normal text : spaced colon : more text")
  })
})