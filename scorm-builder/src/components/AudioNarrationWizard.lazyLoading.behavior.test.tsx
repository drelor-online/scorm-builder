/**
 * Test file: AudioNarrationWizard.lazyLoading.behavior.test.tsx
 *
 * BEHAVIOR-BASED TDD TEST
 *
 * Problem: When loading projects with many audio files (22+), the Audio Narration
 * page hangs forever because it tries to load ALL audio files concurrently,
 * creating blob URLs for all of them at once.
 *
 * Expected Behavior After Fix:
 * 1. Page should load quickly with many audio files (metadata only)
 * 2. Audio blob URLs should only be created when user plays audio
 * 3. Memory usage should be kept low by cleaning up unused blob URLs
 * 4. Previous audio URLs should be revoked when switching to new audio
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

// Mock data: Large project with 22 audio files
const createLargeProjectWithManyAudioFiles = (): CourseContentUnion => ({
  welcomePage: {
    title: "Welcome",
    content: "Welcome content",
    audioNarration: "audio-0"
  },
  learningObjectivesPage: {
    title: "Learning Objectives",
    content: "Objectives content",
    audioNarration: "audio-1"
  },
  // 20 topics, each with audio
  topics: Array.from({ length: 20 }, (_, i) => ({
    id: `topic-${i + 1}`,
    title: `Topic ${i + 1}`,
    content: `Content for topic ${i + 1}`,
    audioNarration: `audio-${i + 2}` // audio-2 through audio-21
  }))
})

// Mock storage with 22 audio files
const mockStorageWith22AudioFiles = {
  currentProjectId: '1756944000180',
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

// Mock MediaService with simulated 22 audio files
const mockMediaServiceWith22Files = {
  getMedia: vi.fn(),
  storeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  updateYouTubeVideoMetadata: vi.fn(),
  clearCache: vi.fn(),
  hasAudioCached: vi.fn((id: string) => id.startsWith('audio-')),
  getCachedAudio: vi.fn((id: string) => {
    if (id.startsWith('audio-')) {
      // Simulate 1MB audio files
      const mockAudioData = new Uint8Array(1024 * 1024) // 1MB
      return {
        data: mockAudioData,
        metadata: {
          type: 'audio',
          mimeType: 'audio/mpeg',
          original_name: `${id}.mp3`
        }
      }
    }
    return null
  }),
  clearAudioFromCache: vi.fn()
}

// Mock createBlobUrl to track when blob URLs are created
const mockCreateBlobUrl = vi.fn()
const mockRevokeBlobUrl = vi.fn()

const mockMediaActions = {
  storeMedia: vi.fn(),
  createBlobUrl: mockCreateBlobUrl,
  revokeBlobUrl: mockRevokeBlobUrl,
  deleteMedia: vi.fn(),
  updateYouTubeVideoMetadata: vi.fn(),
  clearCache: vi.fn()
}

// Helper to wrap component with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <PersistentStorageProvider mockStorage={mockStorageWith22AudioFiles}>
      <UnifiedMediaProvider
        mockMediaService={mockMediaServiceWith22Files}
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

describe('AudioNarrationWizard - Lazy Loading Performance Optimization', () => {
  let largeProjectData: CourseContentUnion

  beforeEach(() => {
    largeProjectData = createLargeProjectWithManyAudioFiles()
    vi.clearAllMocks()

    // Mock URL.createObjectURL to track blob URL creation
    global.URL.createObjectURL = vi.fn((blob) => `blob:mock-url-${Math.random()}`)
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Performance Issues (Current Behavior - Should Fail)', () => {
    it('should currently load ALL audio files immediately causing performance hang', async () => {
      // This test documents the current problematic behavior
      // It should FAIL until we implement lazy loading

      const start = performance.now()

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Wait for component to try loading all audio files
      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      }, { timeout: 10000 })

      const loadTime = performance.now() - start

      // Current behavior: tries to create blob URLs for ALL audio files
      await waitFor(() => {
        expect(mockCreateBlobUrl).toHaveBeenCalledTimes(22)
      }, { timeout: 5000 })

      // This should FAIL because current implementation loads everything
      expect(loadTime).toBeLessThan(1000) // Should load quickly (will fail currently)
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(0) // Should not create any blob URLs initially (will fail currently)
    })
  })

  describe('Expected Behavior After Lazy Loading Implementation', () => {
    it('should load page quickly without creating blob URLs initially', async () => {
      // After fix: page should load quickly with just metadata

      const start = performance.now()

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Page should load quickly
      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      }, { timeout: 2000 })

      const loadTime = performance.now() - start

      // Should load fast without creating any blob URLs initially
      expect(loadTime).toBeLessThan(1000)
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(0)
    })

    it('should create blob URL only when user clicks play on specific audio', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      // Initially no blob URLs created
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(0)

      // Find and click play button for first audio
      const playButtons = screen.getAllByLabelText(/play/i)

      await act(async () => {
        fireEvent.click(playButtons[0])
      })

      // Should create blob URL only for the clicked audio
      await waitFor(() => {
        expect(mockCreateBlobUrl).toHaveBeenCalledTimes(1)
      })

      expect(mockCreateBlobUrl).toHaveBeenCalledWith('audio-0')
    })

    it('should revoke previous blob URL when switching to different audio', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      const playButtons = screen.getAllByLabelText(/play/i)

      // Play first audio
      await act(async () => {
        fireEvent.click(playButtons[0])
      })

      await waitFor(() => {
        expect(mockCreateBlobUrl).toHaveBeenCalledWith('audio-0')
      })

      // Play second audio
      await act(async () => {
        fireEvent.click(playButtons[1])
      })

      // Should create blob URL for second audio
      await waitFor(() => {
        expect(mockCreateBlobUrl).toHaveBeenCalledWith('audio-1')
      })

      // Should revoke the first blob URL to free memory
      expect(mockRevokeBlobUrl).toHaveBeenCalledTimes(1)
    })

    it('should show loading indicator while creating blob URL for large audio file', async () => {
      // Simulate slow blob URL creation for large files
      mockCreateBlobUrl.mockImplementation((id) => {
        return new Promise(resolve => {
          setTimeout(() => resolve(`blob:mock-${id}`), 1000)
        })
      })

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      const playButtons = screen.getAllByLabelText(/play/i)

      await act(async () => {
        fireEvent.click(playButtons[0])
      })

      // Should show loading indicator while blob URL is being created
      expect(screen.getByTestId('audio-loading-audio-0')).toBeInTheDocument()

      // Wait for blob URL creation to complete
      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-audio-0')).not.toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should handle memory efficiently with cache limits', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      const playButtons = screen.getAllByLabelText(/play/i)

      // Play first 5 audio files rapidly
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.click(playButtons[i])
        })

        await waitFor(() => {
          expect(mockCreateBlobUrl).toHaveBeenCalledWith(`audio-${i}`)
        })
      }

      // Should have created 5 blob URLs
      expect(mockCreateBlobUrl).toHaveBeenCalledTimes(5)

      // Should have revoked older URLs to maintain cache limit (keep last 3)
      expect(mockRevokeBlobUrl).toHaveBeenCalledTimes(2) // Revoked first 2
    })
  })

  describe('Error Handling with Lazy Loading', () => {
    it('should handle blob URL creation failures gracefully', async () => {
      mockCreateBlobUrl.mockRejectedValue(new Error('Blob creation failed'))

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={largeProjectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument()
      })

      const playButtons = screen.getAllByLabelText(/play/i)

      await act(async () => {
        fireEvent.click(playButtons[0])
      })

      // Should show error message instead of crashing
      await waitFor(() => {
        expect(screen.getByText(/failed to load audio/i)).toBeInTheDocument()
      })
    })
  })
})