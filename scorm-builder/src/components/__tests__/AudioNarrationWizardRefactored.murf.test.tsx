import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AudioNarrationWizard } from '../AudioNarrationWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'

describe('AudioNarrationWizardRefactored - Murf.ai Integration', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome</p>',
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
      content: '<p>Objectives</p>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
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

  it('should have Murf.ai instructions within the bulk upload section', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    // Find the bulk upload section
    const bulkUploadSection = screen.getByText('Bulk Audio Upload with Murf.ai Integration').closest('section')
    expect(bulkUploadSection).toBeInTheDocument()
    
    // Murf.ai instructions should be within this section, not separate
    const murfInstructions = within(bulkUploadSection!).getByText(/How to use Murf.ai/i)
    expect(murfInstructions).toBeInTheDocument()
    
    // Should not have a separate Murf.ai Instructions card/section
    const separateMurfTitle = screen.queryByRole('heading', { name: /^Murf\.ai Instructions$/i })
    expect(separateMurfTitle).not.toBeInTheDocument()
  })

  it('should show Murf.ai instructions in a collapsible or integrated format', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    const bulkUploadCard = screen.getByText('Bulk Audio Upload with Murf.ai Integration').closest('.card')
    
    // Check that Murf.ai content is within the bulk upload card
    expect(within(bulkUploadCard as HTMLElement).getByRole('link', { name: /murf\.ai/i })).toBeInTheDocument()
    expect(within(bulkUploadCard as HTMLElement).getByText(/120\+ AI voices in different accents/i)).toBeInTheDocument()
    expect(within(bulkUploadCard as HTMLElement).getByText(/File naming convention/i)).toBeInTheDocument()
  })

  it('should not display note about paid plan', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    // Should not show paid plan note
    expect(screen.queryByText(/paid plan/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument()
  })
})