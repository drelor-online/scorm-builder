import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockResolvedValue({
      files: {
        '0001.mp3': { name: '0001.mp3', async: vi.fn().mockResolvedValue(new ArrayBuffer(100)) },
        '0002.mp3': { name: '0002.mp3', async: vi.fn().mockResolvedValue(new ArrayBuffer(100)) },
        '0001.vtt': { name: '0001.vtt', async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nCaption 1') },
        '0002.vtt': { name: '0002.vtt', async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nCaption 2') }
      },
      file: vi.fn().mockImplementation((name: string) => {
        const files: Record<string, { async: any }> = {
          '0001.mp3': { async: vi.fn().mockResolvedValue(new ArrayBuffer(100)) },
          '0002.mp3': { async: vi.fn().mockResolvedValue(new ArrayBuffer(100)) },
          '0001.vtt': { async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nCaption 1') },
          '0002.vtt': { async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nCaption 2') }
        }
        return files[name]
      })
    })
  }))
}))

const mockCourseContent = {
  title: 'Test Course',
  topics: [
    {
      id: 'topic1',
      title: 'Introduction',
      content: 'Topic content 1',
      narration: 'This is the narration for topic 1',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    {
      id: 'topic2', 
      title: 'Advanced Topics',
      content: 'Topic content 2',
      narration: 'This is the narration for topic 2',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    }
  ],
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 2
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Objectives narration',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 3
  },
  assessment: {
    questions: [],
    passMark: 80,
    narration: null
  }
}

describe('AudioNarrationWizard - Bulk Upload', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should display bulk upload section with download narration and upload buttons', async () => {
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)

    // Check for bulk upload section
    expect(screen.getByText(/Bulk Audio Upload/i)).toBeInTheDocument()
    
    // Check for download narration button
    const downloadButton = screen.getByTestId('download-narration-button')
    expect(downloadButton).toBeInTheDocument()
    expect(downloadButton).toHaveTextContent('Download Narration Text')
    
    // Check for upload buttons
    expect(screen.getByTestId('upload-audio-zip-button')).toBeInTheDocument()
    expect(screen.getByTestId('upload-caption-zip-button')).toBeInTheDocument()
  })

  test('should download narration text when download button is clicked', async () => {
    const mockCreateElement = vi.spyOn(document, 'createElement')
    const mockClick = vi.fn()
    const mockHref = vi.fn()
    
    mockCreateElement.mockReturnValue({
      click: mockClick,
      set href(value: string) { mockHref(value) },
      download: ''
    } as any)

    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)

    const downloadButton = screen.getByTestId('download-narration-button')
    fireEvent.click(downloadButton)

    expect(mockCreateElement).toHaveBeenCalledWith('a')
    expect(mockClick).toHaveBeenCalled()
  })

  test('should handle bulk audio ZIP upload', async () => {
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)

    // Create a mock ZIP file
    const file = new File(['fake zip content'], 'audio-files.zip', { type: 'application/zip' })
    
    // Find and click the upload button
    const uploadButton = screen.getByTestId('upload-audio-zip-button')
    fireEvent.click(uploadButton)
    
    // Find the hidden file input and trigger change
    const fileInput = screen.getByTestId('audio-zip-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Wait for processing
    await waitFor(() => {
      expect(screen.getByText(/2 audio files uploaded/i)).toBeInTheDocument()
    })
  })

  test('should handle bulk caption ZIP upload', async () => {
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)

    // Create a mock ZIP file
    const file = new File(['fake zip content'], 'caption-files.zip', { type: 'application/zip' })
    
    // Find and click the upload button
    const uploadButton = screen.getByTestId('upload-caption-zip-button')
    fireEvent.click(uploadButton)
    
    // Find the hidden file input and trigger change
    const fileInput = screen.getByTestId('caption-zip-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Wait for processing
    await waitFor(() => {
      expect(screen.getByText(/2 caption files uploaded/i)).toBeInTheDocument()
    })
  })

  test('should show warning about bulk upload replacing existing files', () => {
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)

    expect(screen.getByText(/Bulk upload will replace all existing audio and caption files/i)).toBeInTheDocument()
  })
})