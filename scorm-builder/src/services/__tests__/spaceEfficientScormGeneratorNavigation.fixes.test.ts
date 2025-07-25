import { describe, it, expect } from 'vitest'
import { generateEnhancedNavigationJs } from '../spaceEfficientScormGeneratorNavigation'

describe('Navigation Generator Fixes', () => {
  it('should use actual course data instead of hardcoded placeholders', () => {
    const navigationJs = generateEnhancedNavigationJs()
    
    // Check that it's not using hardcoded welcome content
    expect(navigationJs).not.toContain('<h1>Welcome to the Course</h1>')
    expect(navigationJs).not.toContain('<p>Click Next to begin your learning journey.</p>')
    
    // Check that it's not using hardcoded objectives
    expect(navigationJs).not.toContain('<li>Understand key concepts</li>')
    expect(navigationJs).not.toContain('<li>Apply knowledge in practice</li>')
    
    // Check that it's not using generic "Topic X" titles
    expect(navigationJs).not.toContain("'Topic ' + topicNumber")
    
    // Should load content from actual pages instead
    expect(navigationJs).toContain('iframe')
    expect(navigationJs).toContain('pages/welcome.html')
    expect(navigationJs).toContain('pages/objectives.html')
  })
  
  it('should use topic titles from courseTopics data', () => {
    const navigationJs = generateEnhancedNavigationJs()
    
    // Should reference the courseTopics array for titles
    expect(navigationJs).toContain('window.courseTopics')
    expect(navigationJs).toContain('.find(t => t.id')
    expect(navigationJs).toContain('topic.title')
  })
  
  it('should maintain consistent loading approach for all pages', () => {
    const navigationJs = generateEnhancedNavigationJs()
    
    // All pages should be loaded via iframe for consistency
    const iframeCount = (navigationJs.match(/iframe/g) || []).length
    expect(iframeCount).toBeGreaterThan(3) // welcome, objectives, topics, assessment
  })
})