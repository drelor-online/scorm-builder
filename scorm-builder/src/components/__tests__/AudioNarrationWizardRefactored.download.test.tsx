import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AudioNarrationWizard } from '../AudioNarrationWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'

describe('AudioNarrationWizardRefactored - Download Format', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome</p>',
      narration: 'Welcome to this course.',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives</p>',
      narration: 'You will learn important concepts.',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: '<p>Topic content</p>',
      narration: 'This is topic one content.',
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

  let clickSpy: any

  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test')
    global.URL.revokeObjectURL = vi.fn()
    
    // Mock document.createElement for download
    clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === 'a') {
        element.click = clickSpy
      }
      return element
    })
  })

  it('should download narration without block headers', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    // Click download button
    const downloadButton = screen.getByText('Download Narration Text')
    fireEvent.click(downloadButton)
    
    // Check the blob content
    const blobCall = (global.URL.createObjectURL as any).mock.calls[0]
    const blob = blobCall[0]
    
    // Read the blob content
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      
      // Should NOT contain block headers
      expect(content).not.toContain('[0001-Block]')
      expect(content).not.toContain('[0002-Block]')
      expect(content).not.toContain('[Block]')
      
      // Should contain the actual narration text
      expect(content).toContain('Welcome to this course.')
      expect(content).toContain('You will learn important concepts.')
      expect(content).toContain('This is topic one content.')
      
      // Should be plain text with simple separation
      const lines = content.split('\n').filter(line => line.trim())
      expect(lines[0]).toBe('Welcome to this course.')
      expect(lines[1]).toBe('You will learn important concepts.')
      expect(lines[2]).toBe('This is topic one content.')
    }
    
    reader.readAsText(blob)
  })

  it('should have proper separation between narration blocks', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    const downloadButton = screen.getByText('Download Narration Text')
    fireEvent.click(downloadButton)
    
    const blobCall = (global.URL.createObjectURL as any).mock.calls[0]
    const blob = blobCall[0]
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      
      // Should have double newline between blocks for readability
      expect(content).toMatch(/Welcome to this course\.\n\nYou will learn important concepts\./)
    }
    
    reader.readAsText(blob)
  })
})