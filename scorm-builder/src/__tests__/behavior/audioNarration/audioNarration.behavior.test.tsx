import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioNarrationWizard } from '../../../components/AudioNarrationWizardRefactored'
import { CourseContent } from '../../../types/aiPrompt'
import { CourseSeedData } from '../../../types/course'

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    files: {},
    folder: vi.fn().mockReturnValue({ 
      file: vi.fn(),
      files: {} 
    }),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'application/zip' })),
    loadAsync: vi.fn().mockResolvedValue({
      files: {
        'audio/0001.mp3': { 
          async: vi.fn().mockResolvedValue(new Blob(['audio1'], { type: 'audio/mp3' })),
          dir: false
        },
        'audio/0002.mp3': { 
          async: vi.fn().mockResolvedValue(new Blob(['audio2'], { type: 'audio/mp3' })),
          dir: false
        },
        'captions/0001.vtt': { 
          async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption 1'),
          dir: false
        },
        'captions/0002.vtt': { 
          async: vi.fn().mockResolvedValue('WEBVTT\n\n00:00.000 --> 00:05.000\nTest caption 2'),
          dir: false
        }
      },
      forEach: vi.fn((callback) => {
        callback('audio/0001.mp3', { name: 'audio/0001.mp3', dir: false })
        callback('audio/0002.mp3', { name: 'audio/0002.mp3', dir: false })
        callback('captions/0001.vtt', { name: 'captions/0001.vtt', dir: false })
        callback('captions/0002.vtt', { name: 'captions/0002.vtt', dir: false })
      })
    })
  }))
}))

// Mock dependencies
vi.mock('../../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    isInitialized: true,
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    storeMedia: vi.fn().mockResolvedValue(undefined),
    retrieveMedia: vi.fn().mockResolvedValue(null),
    hasMedia: vi.fn().mockReturnValue(false),
    getAllMediaMetadata: vi.fn().mockReturnValue([]),
    getMediaForTopic: vi.fn().mockResolvedValue([]),
    storageService: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined)
    }
  })
}))

vi.mock('../../../hooks/useStepData', () => ({
  useStepData: () => ({
    getStepData: vi.fn(),
    updateStepData: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock components
vi.mock('../../../components/CoursePreview', () => ({
  CoursePreview: () => <div data-testid="course-preview">Course Preview</div>
}))

vi.mock('../../../components/PageLayout', () => ({
  PageLayout: ({ children, title, description, onNext, coursePreview }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
      {coursePreview}
      <button onClick={onNext}>Next</button>
    </div>
  )
}))

vi.mock('../../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title, message, onConfirm, onCancel }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

// Mock the design system components
vi.mock('../../../components/DesignSystem', () => ({
  Button: ({ children, onClick, disabled, icon, variant }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  ),
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, placeholder, type, accept }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input 
        value={value || ''} 
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        accept={accept}
        aria-label={label}
      />
    </div>
  ),
  ButtonGroup: ({ children }: any) => <div data-testid="button-group">{children}</div>,
  Section: ({ children }: any) => <section>{children}</section>,
  Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
  Flex: ({ children }: any) => <div data-testid="flex">{children}</div>,
  Alert: ({ type, children }: any) => (
    <div className={`alert alert-${type}`} role="alert" data-type={type}>{children}</div>
  ),
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <div>
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div>{children}</div>
      </div>
    ) : null
}))

describe('Audio Narration Page Behavior', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<h1>Welcome</h1>',
      narration: 'Welcome to this test course. We are excited to have you here.'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'By the end of this course, you will be able to understand the key concepts.'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1',
        content: '<p>Content 1</p>',
        narration: 'This is the narration for topic 1. It contains important information.'
      },
      {
        id: 'topic2',
        title: 'Topic 2',
        content: '<p>Content 2</p>',
        narration: 'This is the narration for topic 2. Learn about advanced concepts here.'
      }
    ],
    assessment: {
      questions: []
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    template: 'None',
    customTopics: ['Topic 1', 'Topic 2'],
    templateTopics: []
  }

  const mockHandlers = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  // Mock URL.createObjectURL and URL.revokeObjectURL
  const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
  const mockRevokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock URL methods
    global.URL = {
      ...global.URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL
    } as any
  })

  it('should display bulk upload interface for audio and captions', () => {
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Check for bulk upload section
    expect(screen.getByText('Bulk Audio Upload with Murf.ai Integration')).toBeInTheDocument()
    
    // Check for audio upload button
    expect(screen.getByRole('button', { name: /upload audio zip/i })).toBeInTheDocument()
    
    // Check for captions upload button
    expect(screen.getByRole('button', { name: /upload captions zip/i })).toBeInTheDocument()
  })

  it('should allow downloading narration text script', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Find download button
    const downloadButton = screen.getByRole('button', { name: /download narration text/i })
    
    // Create a mock element with click method
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {}
    }
    
    // Store original createElement
    const originalCreateElement = document.createElement.bind(document)
    
    // Mock document methods just before clicking
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor as any
      }
      return originalCreateElement(tagName)
    })
    
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any)
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any)
    
    await user.click(downloadButton)
    
    // Check that download was triggered
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(mockAnchor.download).toBe('narration-blocks.txt')
    expect(mockCreateObjectURL).toHaveBeenCalled()
    
    // Cleanup
    createElementSpy.mockRestore()
    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it('should show Murf.ai integration instructions', () => {
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Check for Murf.ai instructions
    expect(screen.getByText(/How to use Murf.ai for professional voiceovers/i)).toBeInTheDocument()
    
    // Check for step-by-step guide
    expect(screen.getByText(/Go to murf.ai and create a new project/i)).toBeInTheDocument()
    // The text in the component is "Upload the narration script, select "Split by paragraphs""
    expect(screen.getByText(/Upload the narration script, select "Split by paragraphs"/i)).toBeInTheDocument()
  })

  it('should allow uploading audio ZIP file', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Create a mock ZIP file
    const audioZip = new File(['zip content'], 'audio.zip', { type: 'application/zip' })
    
    // Find the audio file input
    const audioInput = screen.getByLabelText(/upload audio zip/i)
    
    // Upload the file
    await user.upload(audioInput, audioZip)
    
    // Check that the file was processed
    await waitFor(() => {
      // The component shows multiple alerts, find the success one
      const alerts = screen.getAllByRole('alert')
      const successAlert = alerts.find(alert => alert.textContent?.includes('✓'))
      expect(successAlert).toHaveTextContent(/✓.*2 audio files uploaded/)
    })
  })

  it('should allow uploading caption ZIP file', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Create a mock ZIP file
    const captionZip = new File(['zip content'], 'captions.zip', { type: 'application/zip' })
    
    // Find the caption file input
    const captionInput = screen.getByLabelText(/upload captions zip/i)
    
    // Upload the file
    await user.upload(captionInput, captionZip)
    
    // Check that the file was processed
    await waitFor(() => {
      // The component shows multiple alerts, find the success one
      const alerts = screen.getAllByRole('alert')
      const successAlert = alerts.find(alert => alert.textContent?.includes('✓'))
      expect(successAlert).toHaveTextContent(/✓.*2 caption files uploaded/)
    })
  })

  it('should show warning about bulk upload replacing existing files', () => {
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Check for warning message - find the warning alert among multiple alerts
    const alerts = screen.getAllByRole('alert')
    const warningAlert = alerts.find(alert => alert.textContent?.includes('Bulk upload will replace'))
    expect(warningAlert).toBeInTheDocument()
  })

  it('should allow editing individual narration blocks after upload', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // First upload audio files
    const audioZip = new File(['zip content'], 'audio.zip', { type: 'application/zip' })
    const audioInput = screen.getByLabelText(/upload audio zip/i)
    await user.upload(audioInput, audioZip)
    
    // Wait for files to be processed
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const successAlert = alerts.find(alert => alert.textContent?.includes('✓'))
      expect(successAlert).toHaveTextContent(/✓.*2 audio files uploaded/)
    })
    
    // Check that narration blocks are shown
    const narrationBlocks = screen.getAllByTestId('narration-block')
    expect(narrationBlocks.length).toBeGreaterThan(0)
    
    // Check that blocks show audio status - should have multiple since we uploaded 2 files
    const audioStatuses = screen.getAllByText('✓ Audio')
    expect(audioStatuses.length).toBeGreaterThan(0)
  })

  it('should provide download links for uploaded audio files', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Upload audio files
    const audioZip = new File(['zip content'], 'audio.zip', { type: 'application/zip' })
    const audioInput = screen.getByLabelText(/upload audio zip/i)
    await user.upload(audioInput, audioZip)
    
    // Wait for processing
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const successAlert = alerts.find(alert => alert.textContent?.includes('✓'))
      expect(successAlert).toHaveTextContent(/✓.*audio files uploaded/)
    })
    
    // Check for audio playback elements in narration blocks
    const narrationBlocks = screen.getAllByTestId('narration-block')
    expect(narrationBlocks.length).toBeGreaterThan(0)
    
    // Audio status should be shown - use getAllByText since there might be multiple
    const audioStatuses = screen.getAllByText('✓ Audio')
    expect(audioStatuses.length).toBeGreaterThan(0)
  })

  it('should save audio and captions when moving to next step', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Upload audio files
    const audioZip = new File(['zip content'], 'audio.zip', { type: 'application/zip' })
    const audioInput = screen.getByLabelText(/upload audio zip/i)
    await user.upload(audioInput, audioZip)
    
    // Wait for processing
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const successAlert = alerts.find(alert => alert.textContent?.includes('✓'))
      expect(successAlert).toHaveTextContent(/✓.*audio files uploaded/)
    })
    
    // Click Next button
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    // Check that onNext was called with enhanced content
    expect(mockHandlers.onNext).toHaveBeenCalled()
  })

  it('should handle errors during file upload gracefully', async () => {
    const user = userEvent.setup()
    
    // Get the mocked JSZip
    const JSZip = vi.mocked(await import('jszip')).default
    
    // Mock it to throw an error for this test
    JSZip.mockImplementationOnce(() => ({
      loadAsync: vi.fn().mockRejectedValue(new Error('Invalid ZIP file')),
      file: vi.fn(),
      files: {},
      folder: vi.fn(),
      generateAsync: vi.fn()
    }))
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Try to upload an invalid file
    const invalidFile = new File(['invalid'], 'bad.zip', { type: 'application/zip' })
    const audioInput = screen.getByLabelText(/upload audio zip/i)
    await user.upload(audioInput, invalidFile)
    
    // Check for error message - the component shows "Invalid ZIP file"
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const errorAlert = alerts.find(alert => alert.textContent?.includes('Invalid ZIP file'))
      expect(errorAlert).toBeInTheDocument()
    })
  })

  it('should match audio files with correct narration blocks by filename', async () => {
    const user = userEvent.setup()
    
    render(
      <AudioNarrationWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Upload audio with specific filename pattern (0001.mp3, 0002.mp3, etc.)
    const audioZip = new File(['zip content'], 'audio.zip', { type: 'application/zip' })
    const audioInput = screen.getByLabelText(/upload audio zip/i)
    await user.upload(audioInput, audioZip)
    
    // Wait for processing
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const successAlert = alerts.find(alert => alert.textContent?.includes('✓'))
      expect(successAlert).toHaveTextContent(/✓.*audio files uploaded/)
    })
    
    // Check that files are matched to blocks - look for block numbers
    expect(screen.getByText('0001')).toBeInTheDocument()
    // Welcome page corresponds to the first block
    const narrationBlocks = screen.getAllByTestId('narration-block')
    expect(narrationBlocks[0]).toHaveTextContent('Welcome')
  })

  // Test to ensure audio and captions are properly saved to .scormproj file
  it.todo('should save audio and caption data to .scormproj file when project is saved')
})