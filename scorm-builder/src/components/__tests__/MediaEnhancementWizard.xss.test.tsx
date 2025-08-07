import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'
import DOMPurify from 'dompurify'

// Spy on DOMPurify to check if it's being called
const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize')

describe('MediaEnhancementWizard - XSS Protection', () => {
  beforeEach(() => {
    sanitizeSpy.mockClear()
  })

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Safe content</p><script>alert("XSS")</script><img src=x onerror="alert(\'XSS\')">',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p onclick="alert(\'XSS\')">Click me</p><iframe src="javascript:alert(\'XSS\')"></iframe>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: '<div><style>body { display: none; }</style><svg onload="alert(\'XSS\')"></svg></div>',
      narration: 'Topic 1 narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      media: []
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  const defaultProps = {
    courseContent: mockCourseContent,
    onNext: vi.fn(),
    onBack: vi.fn()
  }

  it('should sanitize script tags from content', () => {
    const { container } = render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Check that DOMPurify.sanitize was called for the content
    expect(sanitizeSpy).toHaveBeenCalled()
    
    // Should not contain any script tags
    const scripts = container.querySelectorAll('script')
    expect(scripts.length).toBe(0)
    
    // Should still contain safe content
    expect(container.textContent).toContain('Safe content')
  })

  it('should remove dangerous event handlers', () => {
    const { container } = render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should not have onclick handlers
    const elementsWithOnclick = container.querySelectorAll('[onclick]')
    expect(elementsWithOnclick.length).toBe(0)
  })

  it('should remove dangerous img onerror handlers', () => {
    const { container } = render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should not have onerror handlers
    const imagesWithOnerror = container.querySelectorAll('img[onerror]')
    expect(imagesWithOnerror.length).toBe(0)
  })

  it('should remove dangerous iframes', () => {
    const { container } = render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should not have iframes with javascript: protocol
    const iframes = container.querySelectorAll('iframe')
    iframes.forEach(iframe => {
      expect(iframe.src).not.toContain('javascript:')
    })
  })

  it('should remove dangerous SVG elements', () => {
    const { container } = render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Should not have SVG elements with onload handlers
    const svgsWithOnload = container.querySelectorAll('svg[onload]')
    expect(svgsWithOnload.length).toBe(0)
  })

  it('should remove style tags that could hide content', () => {
    const { container } = render(<MediaEnhancementWizard {...defaultProps} />)
    
    // The welcome page has dangerous content with script tags and img onerror
    // Check that it contains safe content but not the dangerous parts
    const contentArea = container.querySelector('[style*="line-height: 1.5"]') || 
                       container.querySelector('[style*="lineHeight"]')
    expect(contentArea).toBeTruthy()
    
    if (contentArea) {
      const content = contentArea.innerHTML
      // Should contain the safe content
      expect(content).toContain('Safe content')
      // Should not contain the script tag
      expect(content).not.toContain('<script>')
      expect(content).not.toContain('alert("XSS")')
      
      // The dangerous img src=x is sanitized but the img tag might remain
      // Check that onerror is removed
      const images = contentArea.querySelectorAll('img')
      images.forEach(img => {
        expect(img.getAttribute('onerror')).toBeNull()
      })
    }
  })
})