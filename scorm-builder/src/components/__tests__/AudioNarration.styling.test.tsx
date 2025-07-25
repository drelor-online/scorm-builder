import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudioNarrationWizard } from '../AudioNarrationWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'

describe('AudioNarrationWizard - Styling and Content Updates', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: ['welcome'],
      imagePrompts: ['Welcome prompt'],
      videoSearchTerms: ['welcome video'],
      duration: 2,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      imageKeywords: ['objectives'],
      imagePrompts: ['Objectives prompt'],
      videoSearchTerms: ['objectives video'],
      duration: 3,
      media: []
    },
    topics: [],
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

  describe('Button Label Centering', () => {
    it('should have centered text for Audio Files section', () => {
      const { container } = render(<AudioNarrationWizard {...defaultProps} />)
      
      // Find the Audio Files section
      const audioSection = screen.getByText('Audio Files (.zip)').closest('div')
      expect(audioSection).toBeTruthy()
      const style = audioSection?.getAttribute('style')
      expect(style).toBeTruthy()
      expect(style).toContain('text-align: center')
    })

    it('should have centered text for Caption Files section', () => {
      const { container } = render(<AudioNarrationWizard {...defaultProps} />)
      
      // Find the Caption Files section
      const captionSection = screen.getByText('Caption Files (.zip)').closest('div')
      expect(captionSection).toBeTruthy()
      const style = captionSection?.getAttribute('style')
      expect(style).toBeTruthy()
      expect(style).toContain('text-align: center')
    })

    it('should have centered button groups', () => {
      const { container } = render(<AudioNarrationWizard {...defaultProps} />)
      
      // Find button groups and check their alignment
      const buttonGroups = container.querySelectorAll('.button-group-vertical')
      buttonGroups.forEach(group => {
        const style = group.getAttribute('style')
        expect(style).toBeTruthy()
        expect(style).toContain('align-items: center')
      })
    })
  })

  describe('Murf.ai Instructions', () => {
    it('should display simplified Murf.ai instructions', () => {
      render(<AudioNarrationWizard {...defaultProps} />)
      
      // Check for the main heading
      expect(screen.getByText('How to use Murf.ai for professional voiceovers:')).toBeInTheDocument()
      
      // Check for simplified step-by-step instructions
      expect(screen.getByText(/Go to murf.ai and create a new project/)).toBeInTheDocument()
      expect(screen.getByText(/Upload the narration script, select "Split by paragraphs"/)).toBeInTheDocument()
      expect(screen.getByText(/Select an appropriate voice and preview/)).toBeInTheDocument()
    })

    it('should include audio export instructions', () => {
      render(<AudioNarrationWizard {...defaultProps} />)
      
      // Check for audio export details
      expect(screen.getByText(/For Audio:/)).toBeInTheDocument()
      // Find the li element containing audio export instructions
      const audioLi = screen.getByText(/For Audio:/)
      expect(audioLi).toBeInTheDocument()
      
      // Check that the parent element contains all required text
      const audioParent = audioLi.closest('li')
      expect(audioParent?.textContent).toContain('Select Export → Voice only')
      expect(audioParent?.textContent).toContain('Download as: Split by blocks')
      expect(audioParent?.textContent).toContain('Format: .MP3')
      expect(audioParent?.textContent).toContain('Quality: High')
      expect(audioParent?.textContent).toContain('Channel: Stereo')
    })

    it('should include caption export instructions', () => {
      render(<AudioNarrationWizard {...defaultProps} />)
      
      // Check for caption export details
      expect(screen.getByText(/For Captions:/)).toBeInTheDocument()
      // Find the li element containing caption export instructions
      const captionLi = screen.getByText(/For Captions:/)
      expect(captionLi).toBeInTheDocument()
      
      // Check that the parent element contains all required text
      const captionParent = captionLi.closest('li')
      expect(captionParent?.textContent).toContain('Select Export → Script')
      expect(captionParent?.textContent).toContain('Download as: Split by blocks')
      expect(captionParent?.textContent).toContain('Format: .VTT')
    })

    it('should mention automatic application to topics', () => {
      render(<AudioNarrationWizard {...defaultProps} />)
      
      expect(screen.getByText(/Upload the audio and caption zip files/)).toBeInTheDocument()
      expect(screen.getByText(/will automatically be applied to the right topics/)).toBeInTheDocument()
    })
  })
})