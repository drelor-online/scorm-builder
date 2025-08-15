import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('SCORM Navigation - Assessment Feedback', () => {
  it('should display custom feedback messages from data attributes', () => {
    // Read the navigation.js template
    const jsPath = join(__dirname, '../templates/navigation.js.hbs')
    const jsContent = readFileSync(jsPath, 'utf-8')
    
    // Check if the showFeedback function exists
    expect(jsContent).toContain('function showFeedback')
    
    // Check if it reads feedback from data attributes
    expect(jsContent).toContain('correctFeedback')
    expect(jsContent).toContain('incorrectFeedback')
    
    // Check if it uses the question container's data attributes
    expect(jsContent).toContain('data-correct-feedback')
    expect(jsContent).toContain('data-incorrect-feedback')
  })

  it('should properly extract feedback from question container attributes', () => {
    const jsPath = join(__dirname, '../templates/navigation.js.hbs')
    const jsContent = readFileSync(jsPath, 'utf-8')
    
    // Find the submitAssessment function
    const submitAssessmentMatch = jsContent.match(/window\.submitAssessment[\s\S]*?(?=window\.\w+\s*=|$)/)?.[0] || ''
    
    // Check if it gets the question container
    expect(submitAssessmentMatch).toContain('questionContainer')
    expect(submitAssessmentMatch).toContain('.question-container')
    
    // Check if it reads feedback attributes
    expect(submitAssessmentMatch).toContain('getAttribute')
    expect(submitAssessmentMatch).toContain('data-correct-feedback')
    expect(submitAssessmentMatch).toContain('data-incorrect-feedback')
  })

  it('should display feedback in the feedback div after submission', () => {
    const jsPath = join(__dirname, '../templates/navigation.js.hbs')
    const jsContent = readFileSync(jsPath, 'utf-8')
    
    // Check if feedback is displayed in the correct element
    expect(jsContent).toContain('assessment-feedback-')
    expect(jsContent).toContain('feedbackElement.textContent')
    expect(jsContent).toContain('feedbackElement.style.display')
  })

  it('should generate assessment HTML with feedback attributes populated', () => {
    // Read the assessment template
    const templatePath = join(__dirname, '../templates/assessment.html.hbs')
    const templateContent = readFileSync(templatePath, 'utf-8')
    
    // Check if the template outputs feedback to data attributes
    expect(templateContent).toContain('data-correct-feedback="{{correct_feedback}}"')
    expect(templateContent).toContain('data-incorrect-feedback="{{incorrect_feedback}}"')
    
    // Check if it's on the question container
    expect(templateContent).toContain('<div class="question-container"')
    expect(templateContent).toContain('data-question-index="{{index}}"')
  })
})