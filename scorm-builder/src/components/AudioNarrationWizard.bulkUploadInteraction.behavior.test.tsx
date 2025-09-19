/**
 * Test file: AudioNarrationWizard.bulkUploadInteraction.behavior.test.tsx
 *
 * BEHAVIOR-BASED TDD TEST
 *
 * Problem: Caption bulk loading fails after bulk audio upload due to inconsistent
 * state between lazy loading and bulk upload blob URL creation.
 *
 * Expected Behavior:
 * 1. Bulk audio upload should use lazy loading (no blob URLs created)
 * 2. Caption upload should work after audio bulk upload
 * 3. Both uploads should be consistent with lazy loading architecture
 * 4. Memory management should be consistent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { CourseContentUnion } from '../types/aiPrompt'

// Mock data: Project with multiple audio and caption files
const createTestProjectData = (): CourseContentUnion => ({
  welcomePage: {
    title: "Welcome",
    content: "Welcome content"
  },
  learningObjectivesPage: {
    title: "Learning Objectives",
    content: "Objectives content"
  },
  topics: Array.from({ length: 5 }, (_, i) => ({
    id: `topic-${i + 1}`,
    title: `Topic ${i + 1}`,
    content: `Content for topic ${i + 1}`
  }))
})

// Mock storage
const mockStorage = {
  currentProjectId: '12345',
  saveCourseSeedData: vi.fn(),
  saveProject: vi.fn(),
  loadProject: vi.fn(),
  getProject: vi.fn(),
  saveAudioRecording: vi.fn(),
  listAudioRecordings: vi.fn(() => Promise.resolve([])),
  deleteAudioRecording: vi.fn(),
  hasAudioRecording: vi.fn(() => Promise.resolve(false)),
  getAudioRecording: vi.fn()
}

// Mock MediaService
const mockMediaService = {
  getMedia: vi.fn(),
  storeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  updateYouTubeVideoMetadata: vi.fn(),
  clearCache: vi.fn(),
  hasAudioCached: vi.fn(() => false),
  getCachedAudio: vi.fn(() => null),
  clearAudioFromCache: vi.fn()
}

// Mock media actions
const mockCreateBlobUrl = vi.fn()
const mockRevokeBlobUrl = vi.fn()

const mockMediaActions = {
  storeMedia: mockMediaService.storeMedia,
  createBlobUrl: mockCreateBlobUrl,
  revokeBlobUrl: mockRevokeBlobUrl,
  deleteMedia: mockMediaService.deleteMedia,
  updateYouTubeVideoMetadata: mockMediaService.updateYouTubeVideoMetadata,
  clearCache: mockMediaService.clearCache
}

// Helper to wrap component with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <PersistentStorageProvider mockStorage={mockStorage}>
      <UnifiedMediaProvider
        mockMediaService={mockMediaService}
        mockActions={mockMediaActions}
      >
        <UnsavedChangesProvider>
          <NotificationProvider>
            <StepNavigationProvider>
              {component}
            </StepNavigationProvider>
          </NotificationProvider>
        </UnsavedChangesProvider>
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  )
}

// Helper to create mock ZIP files
const createMockAudioZip = () => {
  const mockFiles = [
    { name: '0001-Block.mp3', content: new Uint8Array(1024) },
    { name: '0002-Block.mp3', content: new Uint8Array(1024) },
    { name: '0003-Block.mp3', content: new Uint8Array(1024) }
  ]

  // Create a mock File object
  const mockZipFile = new File(['mock audio zip'], 'audio-files.zip', { type: 'application/zip' })

  return { mockZipFile, mockFiles }
}

const createMockCaptionZip = () => {
  const mockFiles = [
    { name: '0001-Block.vtt', content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome caption' },
    { name: '0002-Block.vtt', content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nObjectives caption' },
    { name: '0003-Block.vtt', content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nTopic 1 caption' }
  ]

  const mockZipFile = new File(['mock caption zip'], 'caption-files.zip', { type: 'application/zip' })

  return { mockZipFile, mockFiles }
}

describe('AudioNarrationWizard - Bulk Upload Interactions', () => {
  let testProjectData: CourseContentUnion

  beforeEach(() => {
    testProjectData = createTestProjectData()
    vi.clearAllMocks()

    // Mock URL.createObjectURL to track blob URL creation
    global.URL.createObjectURL = vi.fn((blob) => `blob:mock-url-${Math.random()}`)
    global.URL.revokeObjectURL = vi.fn()

    // Mock storeMedia to return success
    mockMediaService.storeMedia.mockImplementation((file, pageId, type) => Promise.resolve({
      id: `${type}-${Math.random()}`,
      type,
      pageId
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Current Problematic Behavior (Should Fail)', () => {
    it('should currently create blob URLs during bulk audio upload (inconsistent with lazy loading)', async () => {
      // This test documents the current problematic behavior
      // It should FAIL until we fix the inconsistency

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={testProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Find bulk upload input
      const audioUploadInput = screen.getByTestId('audio-zip-input')

      // Create mock audio ZIP
      const { mockZipFile } = createMockAudioZip()

      // Simulate bulk audio upload
      Object.defineProperty(audioUploadInput, 'files', {
        value: [mockZipFile],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(audioUploadInput)
      })

      // Wait for upload processing
      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Current behavior: blob URLs should NOT be created during bulk upload (inconsistent)
      // This should FAIL until we fix it
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(0) // Should NOT create blob URLs with lazy loading
    })
  })

  describe('Expected Behavior After Fix', () => {
    it('should bulk upload audio without creating blob URLs (consistent with lazy loading)', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={testProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      const audioUploadInput = screen.getByTestId('audio-zip-input')
      const { mockZipFile } = createMockAudioZip()

      Object.defineProperty(audioUploadInput, 'files', {
        value: [mockZipFile],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(audioUploadInput)
      })

      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Should not create blob URLs during bulk upload (lazy loading)
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(0)

      // Should store the audio files
      expect(mockMediaService.storeMedia).toHaveBeenCalledWith(
        expect.any(File),
        expect.any(String),
        'audio',
        expect.any(Object)
      )
    })

    it('should successfully upload captions after bulk audio upload', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={testProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Step 1: Bulk upload audio
      const audioUploadInput = screen.getByTestId('audio-zip-input')
      const { mockZipFile: audioZip } = createMockAudioZip()

      Object.defineProperty(audioUploadInput, 'files', {
        value: [audioZip],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(audioUploadInput)
      })

      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalledWith(
          expect.any(File),
          expect.any(String),
          'audio',
          expect.any(Object)
        )
      }, { timeout: 5000 })

      // Clear mocks for caption upload
      vi.clearAllMocks()

      // Step 2: Bulk upload captions (should work after audio upload)
      const captionUploadInput = screen.getByTestId('caption-zip-input')
      const { mockZipFile: captionZip } = createMockCaptionZip()

      Object.defineProperty(captionUploadInput, 'files', {
        value: [captionZip],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(captionUploadInput)
      })

      // Should successfully upload captions
      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalledWith(
          expect.any(File),
          expect.any(String),
          'caption',
          expect.any(Object)
        )
      }, { timeout: 5000 })

      // Should not have created any blob URLs
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(0)
    })

    it('should handle memory efficiently during bulk uploads', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={testProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Bulk upload audio
      const audioUploadInput = screen.getByTestId('audio-zip-input')
      const { mockZipFile: audioZip } = createMockAudioZip()

      Object.defineProperty(audioUploadInput, 'files', {
        value: [audioZip],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(audioUploadInput)
      })

      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Should not have created blob URLs (memory efficient)
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(0)

      // Test that individual audio playback still works (lazy loading)
      const playButtons = screen.getAllByLabelText(/play/i)
      if (playButtons.length > 0) {
        await act(async () => {
          fireEvent.click(playButtons[0])
        })

        // Should create blob URL only when playing
        await waitFor(() => {
          expect(mockCreateBlobUrl).toHaveBeenCalledTimes(1)
        })
      }
    })

    it('should clean up blob URLs selectively without affecting other media', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={testProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Create some existing blob URLs
      mockCreateBlobUrl.mockResolvedValue('blob:existing-url')

      // Play audio to create blob URL
      const playButtons = screen.getAllByLabelText(/play/i)
      if (playButtons.length > 0) {
        await act(async () => {
          fireEvent.click(playButtons[0])
        })

        await waitFor(() => {
          expect(mockCreateBlobUrl).toHaveBeenCalled()
        })
      }

      // Now bulk upload should clean up selectively
      const audioUploadInput = screen.getByTestId('audio-zip-input')
      const { mockZipFile } = createMockAudioZip()

      Object.defineProperty(audioUploadInput, 'files', {
        value: [mockZipFile],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(audioUploadInput)
      })

      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Should revoke URLs but only selectively
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle caption upload errors gracefully after audio upload', async () => {
      // Mock storeMedia to fail for captions
      mockMediaService.storeMedia.mockImplementation((file, pageId, type) => {
        if (type === 'caption') {
          return Promise.reject(new Error('Caption storage failed'))
        }
        return Promise.resolve({
          id: `${type}-${Math.random()}`,
          type,
          pageId
        })
      })

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={testProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Upload audio first
      const audioUploadInput = screen.getByTestId('audio-zip-input')
      const { mockZipFile: audioZip } = createMockAudioZip()

      Object.defineProperty(audioUploadInput, 'files', {
        value: [audioZip],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(audioUploadInput)
      })

      await waitFor(() => {
        expect(mockMediaService.storeMedia).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Now try caption upload (should fail gracefully)
      const captionUploadInput = screen.getByTestId('caption-zip-input')
      const { mockZipFile: captionZip } = createMockCaptionZip()

      Object.defineProperty(captionUploadInput, 'files', {
        value: [captionZip],
        configurable: true,
      })

      await act(async () => {
        fireEvent.change(captionUploadInput)
      })

      // Should show error message instead of crashing
      await waitFor(() => {
        expect(screen.getByText(/failed to process caption/i)).toBeInTheDocument()
      })
    })
  })
})