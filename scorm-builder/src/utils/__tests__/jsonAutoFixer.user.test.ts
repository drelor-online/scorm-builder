import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - User Reported Issue', () => {
  it('should handle the exact user-reported JSON with colons in line 334', () => {
    // This is the exact scenario the user reported - colons in narration breaking the parser
    const userJSON = `{
  "topics": [
    {
      "id": "topic-10",
      "title": "Compliance Requirements",
      "content": "<p>Part 192 Subpart L requires: complete documentation.</p>",
      "narration": "Part 192 Subpart L requires: proper documentation of all activities. The regulation states: all operators must maintain records."
    }
  ]
}`

    const fixed = smartAutoFixJSON(userJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Verify colons are preserved in both content and narration
    expect(parsed.topics[0].content).toContain("Part 192 Subpart L requires:")
    expect(parsed.topics[0].narration).toContain("Part 192 Subpart L requires:")
    expect(parsed.topics[0].narration).toContain("The regulation states:")
  })

  it('should handle complex real-world JSON with multiple issues', () => {
    // This combines all the issues: unescaped quotes, colons, and multi-line content
    const complexRealJSON = `{
  "welcomePage": {
    "title": "Welcome",
    "content": "<h2>Welcome: Important Information</h2><p>The instructor said: "Follow all procedures"</p>",
    "narration": "Welcome to the course. The regulations state: "Compliance is mandatory". Remember: safety first!"
  },
  "topics": [
    {
      "id": "topic-0",
      "title": "Introduction: Getting Started",
      "content": "<p>Section 1: Overview</p><p>This section covers: basic concepts, requirements, and procedures.</p>",
      "narration": "Let's begin with the basics. Part 192 requires: First, understanding the regulations. Second, implementing proper procedures. The inspector noted: "This isn't optional"."
    }
  ],
  "assessment": {
    "questions": [
      {
        "type": "multiple-choice",
        "question": "What does Part 192 require: which of the following?",
        "options": [
          "Option A: Basic compliance",
          "Option B: Full documentation",
          "Option C: Both A and B"
        ],
        "correctAnswer": "Option C: Both A and B"
      }
    ]
  }
}`

    const fixed = smartAutoFixJSON(complexRealJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Verify all the colons are preserved
    expect(parsed.welcomePage.content).toContain("Welcome: Important Information")
    expect(parsed.welcomePage.content).toContain("The instructor said:")
    expect(parsed.welcomePage.narration).toContain("The regulations state:")
    expect(parsed.welcomePage.narration).toContain("Remember:")
    
    expect(parsed.topics[0].title).toContain("Introduction: Getting Started")
    expect(parsed.topics[0].content).toContain("Section 1: Overview")
    expect(parsed.topics[0].content).toContain("This section covers:")
    expect(parsed.topics[0].narration).toContain("Part 192 requires:")
    expect(parsed.topics[0].narration).toContain("The inspector noted:")
    
    expect(parsed.assessment.questions[0].question).toContain("What does Part 192 require:")
    expect(parsed.assessment.questions[0].options[0]).toContain("Option A: Basic compliance")
    expect(parsed.assessment.questions[0].correctAnswer).toContain("Option C: Both A and B")
    
    // Also verify that quotes were properly escaped
    expect(parsed.welcomePage.narration).toContain("Compliance is mandatory")
    expect(parsed.topics[0].narration).toContain("This isn't optional")
  })
})