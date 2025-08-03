import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent , waitFor , within } from '../../test/testProviders'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
import { CourseContent } from '../../types/aiPrompt'
import JSZip from 'jszip'

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockResolvedValue({
      files: {
        '0001-Block.mp3': { async: vi.fn().mockResolvedValue(new ArrayBuffer(8)) },
        '0002-Block.mp3': { async: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
      }
    })
  }))
}))

describe('AudioNarrationWizard - Bulk Upload Replacement', () => {
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

  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('should show warning that bulk upload replaces existing files', () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    // Look for warning in bulk upload section
    const bulkUploadSection = screen.getByText('Bulk Audio Upload with Murf.ai Integration').closest('section')
    const warning = within(bulkUploadSection!).getByText(/will replace all existing audio/i)
    
    expect(warning).toBeInTheDocument()
  })

  it('should clear all existing audio files before bulk upload', async () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    // First, simulate having some existing audio files
    // This would normally be done through individual uploads
    // For testing, we'll check that the bulk upload clears everything
    
    const fileInput = screen.getByLabelText(/upload audio zip/i).closest('input') as HTMLInputElement
    const mockFile = new File(['test'], 'audio.zip', { type: 'application/zip' })
    
    // Upload bulk audio
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      // Should show success message
      expect(screen.getByText(/2 audio files uploaded/i)).toBeInTheDocument()
    })
    
    // Upload again - should replace, not add
    const mockFile2 = new File(['test2'], 'audio2.zip', { type: 'application/zip' })
    fireEvent.change(fileInput, { target: { files: [mockFile2] } })
    
    await waitFor(() => {
      // Should still show 2 files, not 4
      expect(screen.getByText(/2 audio files uploaded/i)).toBeInTheDocument()
    })
  })

  it('should clear all existing caption files before bulk upload', async () => {
    render(<AudioNarrationWizard {...defaultProps} />)
    
    const captionInput = screen.getByLabelText(/upload captions? zip/i).closest('input') as HTMLInputElement
    const mockFile = new File(['test'], 'captions.zip', { type: 'application/zip' })
    
    // Mock caption files in zip
    const mockZip = {
      loadAsync: vi.fn().mockResolvedValue({
        files: {
          '0001-Block.vtt': { async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption') },
          '0002-Block.vtt': { async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption 2') }
        }
      })
    }
    ;(JSZip as any).mockImplementation(() => mockZip)
    
    // Upload captions
    fireEvent.change(captionInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/2 caption files uploaded/i)).toBeInTheDocument()
    })
    
    // Upload again - should replace
    fireEvent.change(captionInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      // Should still show 2 files, not 4
      expect(screen.getByText(/2 caption files uploaded/i)).toBeInTheDocument()
    })
  })
})