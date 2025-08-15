import { describe, it, expect } from 'vitest'
import { smartAutoFixJSON } from '../jsonAutoFixer'

describe('JSON Auto-Fixer - Real World Test', () => {
  it('should fix the exact JSON that was failing at line 5, column 733', () => {
    // This is a snippet of the actual JSON that was failing
    const problematicJSON = `{
  "welcomePage": {
    "id": "welcome",
    "title": "Welcome to 49 CFR Part 192: Gas Pipeline Safety Standards",
    "content": "<h2>Welcome to Your Comprehensive Guide to Natural Gas Pipeline Safety!</h2><p>This course provides a detailed exploration of Title 49, Code of Federal Regulations, Part 192 -- the cornerstone of natural gas pipeline safety in the United States. Whether you are a pipeline engineer, a field operator, a compliance manager, or new to the industry, this training will equip you with the essential knowledge to understand and apply these critical federal standards.</p><p>We will break down the complex regulations enforced by the Pipeline and Hazardous Materials Safety Administration (PHMSA) into understandable segments. From pipeline design and construction to operation, maintenance, and integrity management, you'll gain a thorough understanding of the requirements that ensure the safe transportation of natural gas to millions of Americans. Let's begin this journey to enhance safety and compliance in the pipeline industry.</p>",
    "narration": "Hello and welcome. This course is your comprehensive guide to understanding Title 49 of the Code of Federal Regulations, Part 192, which governs the safety of natural gas pipelines. These regulations, enforced by the Pipeline and Hazardous Materials Safety Administration, or PHMSA, are fundamental to our industry. They establish the minimum federal safety standards for the entire lifecycle of a pipeline, from its initial design and material selection to its construction, testing, operation, and eventual retirement. Over the next few modules, we'll demystify these regulations. We'll explore how pipelines are designed based on population density, the specific materials and welding techniques required, and the rigorous testing procedures that ensure a pipeline is fit for service. We'll also delve into the ongoing responsibilities of an operator, including corrosion control, maintenance, and sophisticated integrity management programs designed to prevent failures before they happen. You'll learn about the differences between transmission, distribution, and gathering lines, and how the rules apply to each. This course is structured to be practical and directly applicable to your work. By the end, you'll not only be familiar with the key subparts of Part 192, but you'll also understand the 'why' behind the rules--the safety principles that protect the public and the environment. Thank you for joining, and let's get started."
  }
}`

    // Apply the auto-fix
    const fixed = smartAutoFixJSON(problematicJSON)
    
    // Should be valid JSON now
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Check that the content is preserved
    expect(parsed.welcomePage.id).toBe('welcome')
    expect(parsed.welcomePage.title).toContain('49 CFR Part 192')
    expect(parsed.welcomePage.narration).toContain("'why' behind the rules")
    expect(parsed.welcomePage.narration).toContain('rules--the safety principles')
  })

  it('should handle complex nested structures with problematic quotes', () => {
    const complexJSON = `{
  "topics": [{
    "id": "topic-4",
    "title": "Steel Pipe Design and Stress Calculations",
    "content": "<h2>The Steel Pipe Design Formula</h2><p>The fundamental formula for determining the design pressure of a steel pipeline is found in §192.105. This formula calculates the maximum pressure a pipe can handle based on its physical properties and location. It is commonly known as Barlow's formula or the hoop stress formula.</p>",
    "knowledgeCheck": {
      "questions": [{
        "type": "multiple-choice",
        "text": "In the steel pipe design formula, what does the variable 'S' represent?",
        "options": [
          "Safety Factor",
          "Specified Minimum Yield Strength (SMYS)",
          "Steel Grade",
          "Service Pressure"
        ],
        "correctAnswer": "Specified Minimum Yield Strength (SMYS)",
        "feedback": {
          "correct": "You got it! 'S' stands for Specified Minimum Yield Strength, which is a fundamental measure of the pipe's material strength.",
          "incorrect": "Not quite. 'S' represents the Specified Minimum Yield Strength (SMYS) of the steel in psi."
        }
      }]
    }
  }]
}`

    const fixed = smartAutoFixJSON(complexJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Check nested content
    expect(parsed.topics[0].knowledgeCheck.questions[0].text).toContain("'S'")
    expect(parsed.topics[0].knowledgeCheck.questions[0].feedback.correct).toContain("'S'")
    expect(parsed.topics[0].knowledgeCheck.questions[0].feedback.incorrect).toContain("'S'")
  })

  it('should handle HTML with class attributes containing quotes', () => {
    const htmlJSON = `{
  "content": "<h2 class="main-heading">Test Title</h2><p>This paragraph contains "quoted text" and more content.</p><div class="alert-box">Warning: This is an "important" message!</div>"
}`

    const fixed = smartAutoFixJSON(htmlJSON)
    
    // Should be valid JSON
    let parsed: any
    expect(() => {
      parsed = JSON.parse(fixed)
    }).not.toThrow()
    
    // Check that HTML structure is preserved
    expect(parsed.content).toContain('main-heading')
    expect(parsed.content).toContain('quoted text')
    expect(parsed.content).toContain('alert-box')
    expect(parsed.content).toContain('important')
  })
})