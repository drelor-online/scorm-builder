import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'

// Mock the storage context
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  listProjects: vi.fn(),
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => mockStorage,
}))

// Mock other dependencies
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    isDebugMode: vi.fn(() => false),
    log: vi.fn(),
  },
}))

// Mock MediaService
const mockMediaService = {
  storeMedia: vi.fn(),
  getMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  loadMediaFromProject: vi.fn(),
  loadMediaFromCourseContent: vi.fn(),
}

vi.mock('../services/MediaService', () => ({
  createMediaService: () => mockMediaService,
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        <UnifiedMediaProvider>
          {children}
        </UnifiedMediaProvider>
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </NotificationProvider>
)

// Mock course content data
const mockCourseContent = {
  welcomePage: { id: 'welcome', title: 'Welcome', content: 'Welcome content' },
  learningObjectivesPage: { id: 'objectives', title: 'Objectives', content: 'Objectives content' },
  topics: [
    { id: 'topic1', title: 'Topic 1', content: 'Topic 1 content' },
    { id: 'topic2', title: 'Topic 2', content: 'Topic 2 content' },
  ],
  assessment: { questions: [] },
}

describe('AudioNarrationWizard Bulk Upload Filename Display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(mockCourseContent)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.listProjects.mockResolvedValue([])
    mockMediaService.storeMedia.mockResolvedValue({ success: true, id: 'test-id' })
    mockMediaService.loadMediaFromProject.mockResolvedValue([])
    mockMediaService.loadMediaFromCourseContent.mockResolvedValue([])
  })

  it('should display filename for each file being uploaded during bulk upload', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <AudioNarrationWizard 
          onNext={onNext} 
          onBack={onBack}
          courseContent={mockCourseContent}
        />
      </TestWrapper>
    )

    // Click on bulk upload button
    const bulkUploadButton = screen.getByTestId('bulk-upload-button')
    fireEvent.click(bulkUploadButton)

    // Should show bulk upload modal
    await waitFor(() => {
      expect(screen.getByTestId('bulk-upload-modal')).toBeInTheDocument()
    })

    // Create mock files with specific names
    const file1 = new File(['audio content 1'], 'welcome-narration.mp3', { type: 'audio/mp3' })
    const file2 = new File(['audio content 2'], 'topic1-narration.mp3', { type: 'audio/mp3' })
    const file3 = new File(['audio content 3'], 'objectives-narration.mp3', { type: 'audio/mp3' })

    // Simulate file selection
    const fileInput = screen.getByTestId('bulk-file-input')
    fireEvent.change(fileInput, { target: { files: [file1, file2, file3] } })

    // Start upload
    const uploadButton = screen.getByTestId('start-bulk-upload-button')
    fireEvent.click(uploadButton)

    // Should show filename for each file being processed
    await waitFor(() => {
      expect(screen.getByTestId('upload-progress-item-0')).toBeInTheDocument()
    })

    // Should display the filename for each upload item
    expect(screen.getByText('welcome-narration.mp3')).toBeInTheDocument()
    expect(screen.getByText('topic1-narration.mp3')).toBeInTheDocument()
    expect(screen.getByText('objectives-narration.mp3')).toBeInTheDocument()

    // Should show progress bar for each file
    expect(screen.getByTestId('progress-bar-0')).toBeInTheDocument()
    expect(screen.getByTestId('progress-bar-1')).toBeInTheDocument()
    expect(screen.getByTestId('progress-bar-2')).toBeInTheDocument()
  })

  it('should show completion checkmark when individual file upload finishes', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    // Mock successful upload with delay for first file
    mockMediaService.storeMedia.mockImplementation((file) => {
      return new Promise((resolve) => {
        if (file.name === 'file1.mp3') {
          setTimeout(() => resolve({ success: true, id: 'file1-id' }), 100)
        } else {
          setTimeout(() => resolve({ success: true, id: 'file2-id' }), 200)
        }
      })
    })

    render(
      <TestWrapper>
        <AudioNarrationWizard 
          onNext={onNext} 
          onBack={onBack}
          courseContent={mockCourseContent}
        />
      </TestWrapper>
    )

    // Open bulk upload and select files
    const bulkUploadButton = screen.getByTestId('bulk-upload-button')
    fireEvent.click(bulkUploadButton)

    await waitFor(() => {
      expect(screen.getByTestId('bulk-upload-modal')).toBeInTheDocument()
    })

    const file1 = new File(['content'], 'file1.mp3', { type: 'audio/mp3' })
    const file2 = new File(['content'], 'file2.mp3', { type: 'audio/mp3' })

    const fileInput = screen.getByTestId('bulk-file-input')
    fireEvent.change(fileInput, { target: { files: [file1, file2] } })

    const uploadButton = screen.getByTestId('start-bulk-upload-button')
    fireEvent.click(uploadButton)

    // Wait for first file to complete
    await waitFor(() => {
      expect(screen.getByTestId('completion-checkmark-0')).toBeInTheDocument()
    }, { timeout: 3000 })

    // First file should show checkmark
    expect(screen.getByTestId('completion-checkmark-0')).toBeInTheDocument()
    
    // Second file should still be uploading (no checkmark yet)
    expect(screen.queryByTestId('completion-checkmark-1')).not.toBeInTheDocument()

    // Wait for second file to complete
    await waitFor(() => {
      expect(screen.getByTestId('completion-checkmark-1')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should show "All files uploaded" message when bulk upload completes', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <AudioNarrationWizard 
          onNext={onNext} 
          onBack={onBack}
          courseContent={mockCourseContent}
        />
      </TestWrapper>
    )

    // Open bulk upload and upload files
    const bulkUploadButton = screen.getByTestId('bulk-upload-button')
    fireEvent.click(bulkUploadButton)

    await waitFor(() => {
      expect(screen.getByTestId('bulk-upload-modal')).toBeInTheDocument()
    })

    const file = new File(['content'], 'test.mp3', { type: 'audio/mp3' })
    const fileInput = screen.getByTestId('bulk-file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    const uploadButton = screen.getByTestId('start-bulk-upload-button')
    fireEvent.click(uploadButton)

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.getByTestId('all-files-uploaded-message')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should show completion message
    expect(screen.getByText(/All files uploaded successfully/i)).toBeInTheDocument()
    
    // Should show checkmark icon
    expect(screen.getByTestId('success-checkmark-icon')).toBeInTheDocument()
  })

  it('should allow canceling bulk upload mid-way', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    // Mock slow upload to allow cancellation
    mockMediaService.storeMedia.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true, id: 'test-id' }), 5000) // Very slow
      })
    })

    render(
      <TestWrapper>
        <AudioNarrationWizard 
          onNext={onNext} 
          onBack={onBack}
          courseContent={mockCourseContent}
        />
      </TestWrapper>
    )

    // Start bulk upload
    const bulkUploadButton = screen.getByTestId('bulk-upload-button')
    fireEvent.click(bulkUploadButton)

    await waitFor(() => {
      expect(screen.getByTestId('bulk-upload-modal')).toBeInTheDocument()
    })

    const file = new File(['content'], 'slow-upload.mp3', { type: 'audio/mp3' })
    const fileInput = screen.getByTestId('bulk-file-input')
    fireEvent.change(fileInput, { target: { files: [file] } })

    const uploadButton = screen.getByTestId('start-bulk-upload-button')
    fireEvent.click(uploadButton)

    // Should show cancel button during upload
    await waitFor(() => {
      expect(screen.getByTestId('cancel-bulk-upload-button')).toBeInTheDocument()
    })

    // Click cancel
    const cancelButton = screen.getByTestId('cancel-bulk-upload-button')
    fireEvent.click(cancelButton)

    // Should show cancellation message
    await waitFor(() => {
      expect(screen.getByText(/Upload cancelled/i)).toBeInTheDocument()
    })

    // Upload should be stopped
    expect(screen.queryByTestId('upload-progress-item-0')).not.toBeInTheDocument()
  })
})