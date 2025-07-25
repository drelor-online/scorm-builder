import { describe, it, expect } from 'vitest'
import { generateEnhancedTopicPage } from '../spaceEfficientScormGeneratorEnhanced'

describe('SCORM Generator - Content Overflow Fix', () => {
  it('should ensure content container has proper overflow handling', () => {
    const mockTopic = {
      id: 'topic-1',
      title: 'Test Topic',
      content: '<p>Long content that might overflow</p>'.repeat(100),
      narration: 'Test narration',
      knowledgeCheck: {
        question: 'Test?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0
      }
    }
    
    const html = generateEnhancedTopicPage(mockTopic, 0, {} as any)
    
    // Should have scrollable content area
    expect(html).toContain('overflow-y: auto')
    expect(html).toContain('height: 100%')
  })
  
  it('should ensure media panel does not cause content cutoff', () => {
    const mockTopic = {
      id: 'topic-1',
      title: 'Test Topic',
      content: '<p>Content</p>',
      narration: 'Test narration',
      media: [{
        id: 'test-media',
        url: 'test.jpg',
        title: 'Test Image',
        type: 'image' as const
      }]
    }
    
    const html = generateEnhancedTopicPage(mockTopic, 0, {} as any)
    
    // Content layout should use CSS Grid properly
    expect(html).toContain('content-layout')
    expect(html).toContain('text-section')
    expect(html).toContain('media-panel')
  })
})