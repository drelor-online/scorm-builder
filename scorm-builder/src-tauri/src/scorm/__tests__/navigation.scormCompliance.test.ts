import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Test SCORM 1.2 compliance in generated navigation.js
describe('SCORM 1.2 Compliance in Navigation Template', () => {
  let navigationTemplate: string

  beforeEach(() => {
    // Read the navigation template
    const templatePath = join(__dirname, '../templates/navigation.js.hbs')
    navigationTemplate = readFileSync(templatePath, 'utf-8')
  })

  it('should not contain automatic LMSFinish calls', () => {
    // Check that we removed automatic LMSFinish calls after assessment
    // The beforeunload handler is OK - that's for when user closes browser
    
    // Should not have setTimeout calling LMSFinish after assessment
    const assessmentSection = navigationTemplate.match(/Assessment passed[\s\S]*?Assessment failed[\s\S]*?catch/g)?.[0] || ''
    expect(assessmentSection).not.toContain('setTimeout')
    
    // Should not have actual LMSFinish API calls (comments are OK)
    const finishApiCalls = assessmentSection.match(/window\.API\.LMSFinish/g) || []
    expect(finishApiCalls.length).toBe(0)
    
    // Should have message about session remaining open
    expect(navigationTemplate).toContain('session remains open for user control')
  })

  it('should set score values in correct order (min/max before raw)', () => {
    // Find the score reporting section
    const scoreSection = navigationTemplate.match(/Reporting score[\s\S]*?LMSCommit/g)?.[0] || ''
    
    // Check order: min should come before raw
    const minIndex = scoreSection.indexOf("LMSSetValue('cmi.core.score.min'")
    const maxIndex = scoreSection.indexOf("LMSSetValue('cmi.core.score.max'")
    const rawIndex = scoreSection.indexOf("LMSSetValue('cmi.core.score.raw'")
    
    expect(minIndex).toBeGreaterThan(-1)
    expect(maxIndex).toBeGreaterThan(-1)
    expect(rawIndex).toBeGreaterThan(-1)
    expect(minIndex).toBeLessThan(rawIndex)
    expect(maxIndex).toBeLessThan(rawIndex)
  })

  it('should not use SCORM 2004 cmi.success_status', () => {
    // Should not contain any SCORM 2004 specific API calls (except in comments)
    const apiCalls = navigationTemplate.match(/LMSSetValue\s*\(\s*['"]cmi\.success_status/g) || []
    expect(apiCalls.length).toBe(0)
    
    // Should use SCORM 1.2 lesson_status values
    expect(navigationTemplate).toContain("LMSSetValue('cmi.core.lesson_status', 'passed')")
    expect(navigationTemplate).toContain("LMSSetValue('cmi.core.lesson_status', 'failed')")
  })

  it('should use proper SCORM 1.2 status values', () => {
    // Check for valid SCORM 1.2 lesson_status values
    const validStatuses = ['passed', 'failed', 'completed', 'incomplete', 'browsed', 'not attempted']
    
    // Extract all lesson_status assignments
    const statusMatches = navigationTemplate.match(/lesson_status['"]\s*,\s*['"](\w+)['"]/g) || []
    
    statusMatches.forEach(match => {
      const status = match.match(/['"](\w+)['"]/)?.[1]
      if (status && status !== 'lesson_status') {
        expect(validStatuses).toContain(status)
      }
    })
  })

  it('should have user-controlled exit functionality', () => {
    // Check index.html template for exit button
    const indexPath = join(__dirname, '../templates/index.html.hbs')
    const indexTemplate = readFileSync(indexPath, 'utf-8')
    
    // Should have exit button
    expect(indexTemplate).toContain('exit-course-button')
    expect(indexTemplate).toContain('exitCourse()')
    
    // Should have proper exit function
    expect(indexTemplate).toContain('function exitCourse()')
    expect(indexTemplate).toContain('LMSCommit')
    expect(indexTemplate).toContain('LMSFinish')
    expect(indexTemplate).toContain('Are you sure you want to exit')
  })

  it('should handle score reporting errors gracefully', () => {
    // Check for try-catch blocks around score reporting
    expect(navigationTemplate).toContain('try {')
    expect(navigationTemplate).toContain('console.log(\'[SCORM] Reporting score:')
    expect(navigationTemplate).toContain('catch (e) {')
    expect(navigationTemplate).toContain('console.error(\'[SCORM] Error')
  })
})