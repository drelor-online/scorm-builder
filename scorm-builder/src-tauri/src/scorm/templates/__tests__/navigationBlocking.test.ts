import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('SCORM templates - navigation blocking', () => {
  it('should have answeredQuestions tracking for knowledge check pages', () => {
    // Read the navigation.js.hbs template
    const navPath = path.join(__dirname, '..', 'navigation.js.hbs')
    const navContent = fs.readFileSync(navPath, 'utf-8')
    
    // Check that answeredQuestions is properly initialized
    expect(navContent).toMatch(/window\.answeredQuestions\s*=\s*window\.answeredQuestions\s*\|\|\s*{}/i)
  })
  
  it('should have PAGES_WITH_KNOWLEDGE_CHECKS populated with correct page IDs', () => {
    const navPath = path.join(__dirname, '..', 'navigation.js.hbs')
    const navContent = fs.readFileSync(navPath, 'utf-8')
    
    // Check that PAGES_WITH_KNOWLEDGE_CHECKS is populated via Handlebars
    expect(navContent).toMatch(/const\s+PAGES_WITH_KNOWLEDGE_CHECKS\s*=\s*{/i)
    
    // Should have Handlebars template for populating the object
    expect(navContent).toMatch(/{{#each\s+topics}}/i)
    expect(navContent).toMatch(/{{#if\s+this\.has_knowledge_check}}/i)
  })
  
  it('should have shouldBlockNavigation function that properly checks knowledge check status', () => {
    const navPath = path.join(__dirname, '..', 'navigation.js.hbs')
    const navContent = fs.readFileSync(navPath, 'utf-8')
    
    // Check for shouldBlockNavigation function
    expect(navContent).toMatch(/function\s+shouldBlockNavigation/i)
    
    // Check that it checks knowledge check status
    expect(navContent).toMatch(/PAGES_WITH_KNOWLEDGE_CHECKS\[window\.currentPage\]/i)
    
    // Check that it looks for unanswered questions
    expect(navContent).toMatch(/window\.answeredQuestions.*?fill-blank|window\.answeredQuestions.*?_q\d+/i)
  })
  
  it('should update answeredQuestions when questions are answered', () => {
    const navPath = path.join(__dirname, '..', 'navigation.js.hbs')
    const navContent = fs.readFileSync(navPath, 'utf-8')
    
    // Check for checkMultipleChoice function
    expect(navContent).toMatch(/window\.checkMultipleChoice\s*=/i)
    
    // Check that it updates answeredQuestions
    expect(navContent).toMatch(/window\.answeredQuestions\[questionKey\]\s*=\s*true/i)
    
    // Check for checkFillInBlank function
    expect(navContent).toMatch(/window\.checkFillInBlank\s*=/i)
    
    // Check that it updates answeredQuestions for fill-in-blank
    expect(navContent).toMatch(/window\.answeredQuestions\[.*fill-blank.*\]\s*=\s*true/i)
  })
})