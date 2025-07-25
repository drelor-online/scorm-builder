import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AudioNarrationWizard } from '../AudioNarrationWizardRefactored'
import { CourseContent } from '../../types/aiPrompt'

describe('AudioNarrationWizardRefactored - Bulk Upload Alignment', () => {
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

  it('should have audio and caption uploads properly aligned side by side', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    const bulkUploadCard = screen.getByText('Bulk Audio Upload with Murf.ai Integration').closest('.card') as HTMLElement
    expect(bulkUploadCard).toBeInTheDocument()
    
    // Find the grid container wrapper
    const uploadGridWrapper = within(bulkUploadCard as HTMLElement).getByTestId('bulk-upload-grid')
    expect(uploadGridWrapper).toBeInTheDocument()
    
    // The actual grid is inside the wrapper
    const grid = uploadGridWrapper.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    
    // Check that audio upload is in first column
    const audioSection = within(uploadGridWrapper).getByText('Audio Files (.zip)').closest('div')
    expect(audioSection).toBeInTheDocument()
    
    // Check that caption upload is in second column
    const captionSection = within(uploadGridWrapper).getByText(/Caption Files.*\.zip/i).closest('div')
    expect(captionSection).toBeInTheDocument()
    
    // Both should be children of the same grid
    expect(audioSection?.parentElement).toBe(captionSection?.parentElement)
  })

  it('should have buttons and text properly aligned within each upload section', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    const bulkUploadCard = screen.getByText('Bulk Audio Upload with Murf.ai Integration').closest('.card')
    
    // Check audio upload section
    const audioSection = within(bulkUploadCard as HTMLElement).getByText('Audio Files (.zip)').closest('div')
    const audioButton = within(audioSection!).getByText('Upload Audio ZIP')
    const audioHeading = within(audioSection!).getByText('Audio Files (.zip)')
    
    // Audio heading should be above button (position value 4 means FOLLOWING)
    expect(audioHeading.compareDocumentPosition(audioButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    
    // Check caption upload section
    const captionSection = within(bulkUploadCard as HTMLElement).getByText(/Caption Files.*\.zip/i).closest('div')
    const captionButton = within(captionSection!).getByText('Upload Captions ZIP')
    const captionHeading = within(captionSection!).getByText(/Caption Files.*\.zip/i)
    
    // Caption heading should be above button (position value 4 means FOLLOWING)
    expect(captionHeading.compareDocumentPosition(captionButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('should have download narration button above the upload grid', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    const bulkUploadCard = screen.getByText('Bulk Audio Upload with Murf.ai Integration').closest('.card')
    const downloadButton = within(bulkUploadCard as HTMLElement).getByText('Download Narration Text')
    const uploadGrid = within(bulkUploadCard as HTMLElement).getByTestId('bulk-upload-grid')
    
    // Download button should be positioned before the upload grid
    expect(downloadButton.compareDocumentPosition(uploadGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})