import { describe, it, expect } from 'vitest'

describe('SCORM Generator - Logo Update', () => {
  it('should use ENTRUST Solutions Group branding instead of simple ENTRUST', () => {
    const mockContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      welcome: { title: 'Welcome', content: 'Test' },
      learningObjectivesPage: { title: 'Objectives', content: 'Test' },
      topics: [],
      assessment: { questions: [] }
    }
    
    const html = generateIndexHtml(mockContent)
    
    // Should not have the old simple branding
    expect(html).not.toContain('<span class="brand">ENTRUST</span>')
    
    // Should have proper logo image
    expect(html).toContain('entrust-logo.svg')
    expect(html).toContain('<img')
    expect(html).toContain('alt="ENTRUST Solutions Group"')
  })
  
  it('should ensure logo is visible on dark background', () => {
    const mockContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      welcome: { title: 'Welcome', content: 'Test' },
      learningObjectivesPage: { title: 'Objectives', content: 'Test' },
      topics: [],
      assessment: { questions: [] }
    }
    
    const html = generateIndexHtml(mockContent)
    
    // Logo should have proper styling for visibility
    expect(html).toContain('logo-img')
  })
})