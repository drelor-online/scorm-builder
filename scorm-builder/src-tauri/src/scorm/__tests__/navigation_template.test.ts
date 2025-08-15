/**
 * Test for SCORM navigation template issues
 * These tests verify the navigation.js template behavior
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('SCORM Navigation Template Issues', () => {
  const templatePath = path.join(__dirname, '..', 'templates', 'navigation.js.hbs')
  let templateContent: string

  beforeAll(() => {
    // Read the actual template file
    templateContent = fs.readFileSync(templatePath, 'utf-8')
  })

  describe('Fill-in-blank feedback issue', () => {
    it('should access dataset properties correctly for hyphenated attributes', () => {
      // The template should use dataset.correctFeedback which maps to data-correct-feedback
      expect(templateContent).toContain('wrapper.dataset.correctFeedback')
      expect(templateContent).toContain('wrapper.dataset.incorrectFeedback')
    })

    it('should have fallback values for missing feedback', () => {
      // Check that fallback values exist
      expect(templateContent).toContain("|| 'Correct!'")
      expect(templateContent).toContain("|| 'Not quite. Try again!'")
    })
  })

  describe('Navigation unlocking issue', () => {
    it('should use page-specific fill-in-blank IDs', () => {
      // Should use page-specific IDs for fill-in-blank questions
      const pageSpecificPattern = /\$\{window\.currentPage\}_fill-blank-\$\{[^}]+\}/
      
      // Should mark questions with page-specific IDs
      expect(templateContent).toMatch(pageSpecificPattern)
      
      // Should not have any global fill-blank-N patterns without page context
      const globalCheckPattern = /window\.answeredQuestions\[`fill-blank-\d+`\]/
      expect(templateContent).not.toMatch(globalCheckPattern)
    })

    it('should check page-specific questions in shouldBlockForwardNavigation', () => {
      // The function should iterate through pages and check their specific questions
      const functionMatch = templateContent.match(/function shouldBlockForwardNavigation[\s\S]*?return false;\s*}/m)
      
      expect(functionMatch).toBeTruthy()
      const functionBody = functionMatch![0]
      
      // Should check for page-specific question IDs
      expect(functionBody).toContain('${pageId}_q0')
      
      // Should check for page-specific fill-in-blank IDs
      expect(functionBody).toContain('${pageId}_fill-blank-0')
    })

    it('should mark questions with page-specific IDs when submitted', () => {
      // When a fill-in-blank is submitted, it should use page-specific ID
      const submitPattern = /window\.answeredQuestions\[.*?\] = true/g
      const matches = templateContent.match(submitPattern) || []
      
      // Should have patterns for both MC and fill-in-blank
      expect(matches.length).toBeGreaterThan(0)
      
      // Check that fill-in-blank uses page context (this will fail)
      const fillBlankSubmit = matches.find(m => m.includes('fill-blank'))
      expect(fillBlankSubmit).toBeTruthy()
      
      // It should include the current page in the ID (this will fail)
      expect(templateContent).toContain('${window.currentPage}_fill-blank')
    })
  })
})