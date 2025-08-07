import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { describe, test, expect, beforeEach, vi, it } from 'vitest'
import { AudioNarrationWizard } from '../AudioNarrationWizard'

// Mock MediaService
const mockMediaService = {
  isInitialized: () => true,
  storeMedia: vi.fn().mockResolvedValue({
    id: 'audio-test',
    type: 'audio',
    pageId: 'test',
    fileName: 'test.mp3'
  }),
  getMedia: vi.fn(),
  deleteMedia: vi.fn(),
  getAllMedia: vi.fn(() => [])
}

vi.mock('../../services/MediaService', () => ({
  MediaService: {
    getInstance: vi.fn(() => mockMediaService)
  },
  createMediaService: vi.fn(() => mockMediaService)
}))

// Mock JSZip
let mockZipFiles: any = {}
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadAsync: vi.fn().mockResolvedValue({
      files: mockZipFiles,
      file: vi.fn().mockImplementation((name: string) => mockZipFiles[name])
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
    // Reset mock ZIP files for each test
    mockZipFiles = {
      '0001-Block.mp3': { 
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(100)) 
      },
      '0002-Block.mp3': { 
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(100)) 
      },
      '0001-Block.vtt': { 
        dir: false,
        async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nCaption 1') 
      },
      '0002-Block.vtt': { 
        dir: false,
        async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nCaption 2') 
      }
    }
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

  it('should handle large audio files (>1MB) in ZIP without Base64 errors', async () => {
    // Create large audio data (1.5MB) to trigger chunked encoding
    const largeAudioSize = 1.5 * 1024 * 1024
    const largeAudioData = new ArrayBuffer(largeAudioSize)
    const uint8View = new Uint8Array(largeAudioData)
    // Fill with pattern to simulate real audio
    for (let i = 0; i < uint8View.length; i++) {
      uint8View[i] = i % 256
    }
    
    // Set up mock ZIP with large audio file
    mockZipFiles = {
      '0001-Block.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(largeAudioData)
      }
    }
    
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)
    
    // Create a mock ZIP file
    const file = new File(['fake zip content'], 'large-audio.zip', { type: 'application/zip' })
    
    // Find and trigger the upload
    const fileInput = screen.getByTestId('audio-zip-input')
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    // Wait for processing - should complete without errors
    await waitFor(() => {
      expect(screen.getByText(/1 audio file/i)).toBeInTheDocument()
    }, { timeout: 10000 }) // Longer timeout for large file
  })

  it('should correctly process audio files with naming format 0001-Block.mp3', async () => {
    // Set up correct file naming
    mockZipFiles = {
      '0001-Block.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      },
      '0002-Block.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      },
      '0003-Block.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      },
      'wrong-name.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }
    }
    
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)
    
    const file = new File(['fake zip content'], 'correct-naming.zip', { type: 'application/zip' })
    const fileInput = screen.getByTestId('audio-zip-input')
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    await waitFor(() => {
      // Should only process the 2 correctly named files (0001 and 0002)
      // 0003 would be skipped as there's no matching narration block
      expect(screen.getByText(/2 audio files uploaded/i)).toBeInTheDocument()
    })
  })

  it('should show user feedback when files are skipped due to incorrect naming', async () => {
    // Set up files with incorrect naming
    mockZipFiles = {
      'audio1.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      },
      'Block-0001.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      },
      '0001.mp3': {
        dir: false,
        async: vi.fn().mockResolvedValue(new ArrayBuffer(1000))
      }
    }
    
    render(<AudioNarrationWizard
            courseContent={mockCourseContent}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />)
    
    const file = new File(['fake zip content'], 'incorrect-naming.zip', { type: 'application/zip' })
    const fileInput = screen.getByTestId('audio-zip-input')
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    // Wait for processing
    await waitFor(() => {
      // Should show an alert about skipped files
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).toBeGreaterThan(0)
      
      // Check for specific feedback about file naming
      const alertText = alerts.map(a => a.textContent).join(' ')
      expect(alertText).toMatch(/skipped|format|0001-Block.mp3/i)
    })
  })
})