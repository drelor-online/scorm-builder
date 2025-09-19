/**
 * Test file: AudioNarrationWizard.captionLoading.behavior.test.tsx
 *
 * BEHAVIOR-BASED TDD TEST
 *
 * Problem: Caption loading from saved projects has multiple issues:
 * 1. Progress shows "Loading audio files... 22/44" but includes captions
 * 2. Each caption triggers separate getMedia() call (22 requests instead of batch)
 * 3. Loading can hang with many captions
 * 4. Captions don't persist when navigating away and back
 *
 * Expected Behavior After Fix:
 * 1. Progress should show "Loading audio and caption files... X/44"
 * 2. Captions should load in batch, not individually
 * 3. Loading should complete quickly without hanging
 * 4. Captions should persist across navigation
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

// Mock project data with 22 audio and 22 caption files (like the real user case)
const createProjectWith22AudioAndCaptions = (): CourseContentUnion => ({
  welcomePage: {
    title: "Welcome",
    content: "Welcome content",
    narration: "Welcome narration text",
    caption: "WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome caption",
    media: [
      { id: 'audio-0', type: 'audio', storageId: 'audio-0', title: '', url: '' },
      { id: 'caption-0', type: 'caption', storageId: 'caption-0', title: '', url: '', content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome caption' }
    ]
  },
  learningObjectivesPage: {
    title: "Learning Objectives",
    content: "Objectives content",
    narration: "Objectives narration text",
    caption: "WEBVTT\n\n00:00.000 --> 00:05.000\nObjectives caption",
    media: [
      { id: 'audio-1', type: 'audio', storageId: 'audio-1', title: '', url: '' },
      { id: 'caption-1', type: 'caption', storageId: 'caption-1', title: '', url: '', content: 'WEBVTT\n\n00:00.000 --> 00:05.000\nObjectives caption' }
    ]
  },
  topics: Array.from({ length: 20 }, (_, i) => ({
    id: `topic-${i + 1}`,
    title: `Topic ${i + 1}`,
    content: `Content for topic ${i + 1}`,
    narration: `Narration for topic ${i + 1}`,
    caption: `WEBVTT\n\n00:00.000 --> 00:05.000\nTopic ${i + 1} caption`,
    media: [
      { id: `audio-${i + 2}`, type: 'audio', storageId: `audio-${i + 2}`, title: '', url: '' },
      { id: `caption-${i + 2}`, type: 'caption', storageId: `caption-${i + 2}`, title: '', url: '', content: `WEBVTT\n\n00:00.000 --> 00:05.000\nTopic ${i + 1} caption` }
    ]
  }))
})

// Mock storage
const mockStorage = {
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

// Mock MediaService that simulates the real behavior from the logs
const mockGetMediaCallCount = { count: 0 }
const mockMediaService = {
  getMedia: vi.fn(),
  storeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  updateYouTubeVideoMetadata: vi.fn(),
  clearCache: vi.fn(),
  hasAudioCached: vi.fn(),
  getCachedAudio: vi.fn(),
  clearAudioFromCache: vi.fn()
}

// Mock media actions
const mockMediaActions = {
  storeMedia: mockMediaService.storeMedia,
  createBlobUrl: vi.fn(),
  revokeBlobUrl: vi.fn(),
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

describe('AudioNarrationWizard - Caption Loading from Saved Projects', () => {
  let projectData: CourseContentUnion

  beforeEach(() => {
    projectData = createProjectWith22AudioAndCaptions()
    vi.clearAllMocks()
    mockGetMediaCallCount.count = 0

    // Mock getMedia to track calls and simulate real behavior
    mockMediaService.getMedia.mockImplementation((mediaId: string) => {
      mockGetMediaCallCount.count++

      if (mediaId.startsWith('audio-')) {
        // Audio files return binary data
        return Promise.resolve({
          data: new Uint8Array(1024), // Mock audio data
          metadata: {
            type: 'audio',
            mimeType: 'audio/mpeg',
            original_name: `${mediaId}.mp3`
          }
        })
      } else if (mediaId.startsWith('caption-')) {
        // Caption files return text data
        const captionContent = `WEBVTT\n\n00:00.000 --> 00:05.000\nCaption for ${mediaId}`
        const textEncoder = new TextEncoder()
        return Promise.resolve({
          data: textEncoder.encode(captionContent),
          metadata: {
            type: 'caption',
            mimeType: 'text/vtt',
            original_name: `${mediaId}.vtt`,
            content: captionContent
          }
        })
      }

      return Promise.reject(new Error(`Media not found: ${mediaId}`))
    })

    // Mock hasAudioCached to return false (force loading from storage)
    mockMediaService.hasAudioCached.mockReturnValue(false)
    mockMediaService.getCachedAudio.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Current Problematic Behavior (Should Fail)', () => {
    it('should currently show misleading progress text "Loading audio files..." when loading both audio and captions', async () => {
      // This test documents the current problematic behavior

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Should show loading screen initially
      await waitFor(() => {
        expect(screen.getByTestId('audio-loading-overlay')).toBeInTheDocument()
      })

      // Current problematic behavior: misleading text
      expect(screen.getByText('Loading audio files...')).toBeInTheDocument()

      // Should show 44 total (22 audio + 22 captions)
      await waitFor(() => {
        expect(screen.getByText(/of 44 files/)).toBeInTheDocument()
      }, { timeout: 5000 })

      // This should FAIL because the text is misleading
      expect(screen.queryByText('Loading audio and caption files...')).toBeInTheDocument() // Will fail
    })

    it('should currently make individual getMedia calls for each caption (inefficient)', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      // Current behavior: should make 44 individual calls (22 audio + 22 captions)
      expect(mockGetMediaCallCount.count).toBe(44)

      // This should FAIL because we want batch loading instead
      expect(mockGetMediaCallCount.count).toBeLessThanOrEqual(2) // Want: 1 batch for audio, 1 for captions (will fail)
    })

    it('should currently potentially hang with many caption files', async () => {
      // Simulate slow caption loading to reproduce hanging
      mockMediaService.getMedia.mockImplementation((mediaId: string) => {
        if (mediaId.startsWith('caption-')) {
          // Simulate slow caption loading
          return new Promise(resolve => {
            setTimeout(() => {
              const captionContent = `WEBVTT\n\n00:00.000 --> 00:05.000\nCaption for ${mediaId}`
              const textEncoder = new TextEncoder()
              resolve({
                data: textEncoder.encode(captionContent),
                metadata: { type: 'caption', content: captionContent }
              })
            }, 100) // 100ms per caption = 2.2 seconds for 22 captions
          })
        }
        // Audio loads normally
        return Promise.resolve({
          data: new Uint8Array(1024),
          metadata: { type: 'audio', mimeType: 'audio/mpeg' }
        })
      })

      const start = performance.now()

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Should complete loading within reasonable time
      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      const loadTime = performance.now() - start

      // This should FAIL because current behavior is slow with many captions
      expect(loadTime).toBeLessThan(1000) // Want: fast loading (will fail currently)
    })
  })

  describe('Expected Behavior After Fix', () => {
    it('should show accurate progress text "Loading audio and caption files..."', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('audio-loading-overlay')).toBeInTheDocument()
      })

      // Should show accurate text
      expect(screen.getByText('Loading audio and caption files...')).toBeInTheDocument()

      // Should show correct total count
      await waitFor(() => {
        expect(screen.getByText(/of 44 files/)).toBeInTheDocument()
      })
    })

    it('should use batch loading for captions instead of individual calls', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Should make minimal calls (batch loading)
      expect(mockGetMediaCallCount.count).toBeLessThanOrEqual(10) // Much fewer than 44 individual calls
    })

    it('should load quickly even with many caption files', async () => {
      const start = performance.now()

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      const loadTime = performance.now() - start

      // Should load quickly
      expect(loadTime).toBeLessThan(2000)
    })

    it('should persist captions when navigating away and back', async () => {
      const onNext = vi.fn()
      const onBack = vi.fn()

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={onNext}
          onBack={onBack}
        />
      )

      // Wait for initial loading
      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Check that captions are visible
      expect(screen.getByText('Welcome')).toBeInTheDocument()

      // Simulate navigation away (next step)
      await act(async () => {
        const nextButton = screen.getByTestId('next-button')
        fireEvent.click(nextButton)
      })

      expect(onNext).toHaveBeenCalled()

      // Simulate coming back with same data
      const { rerender } = screen

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={onNext}
          onBack={onBack}
        />
      )

      // Should NOT show loading screen again (data should be cached)
      expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()

      // Captions should still be present
      expect(screen.getByText('Welcome')).toBeInTheDocument()
    })

    it('should handle caption loading errors gracefully', async () => {
      // Mock some caption failures
      mockMediaService.getMedia.mockImplementation((mediaId: string) => {
        if (mediaId === 'caption-5' || mediaId === 'caption-10') {
          return Promise.reject(new Error('Caption loading failed'))
        }

        if (mediaId.startsWith('caption-')) {
          const captionContent = `WEBVTT\n\n00:00.000 --> 00:05.000\nCaption for ${mediaId}`
          const textEncoder = new TextEncoder()
          return Promise.resolve({
            data: textEncoder.encode(captionContent),
            metadata: { type: 'caption', content: captionContent }
          })
        }

        // Audio loads normally
        return Promise.resolve({
          data: new Uint8Array(1024),
          metadata: { type: 'audio', mimeType: 'audio/mpeg' }
        })
      })

      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Should complete loading despite some caption failures
      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Should still show the main content
      expect(screen.getByText('Welcome')).toBeInTheDocument()

      // Should not show error for failed captions (graceful handling)
      expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
    })
  })

  describe('Performance and Memory', () => {
    it('should not create blob URLs for caption text content', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Should not create blob URLs for text content (captions)
      // Only audio files should create blob URLs when played
      expect(mockMediaActions.createBlobUrl).toHaveBeenCalledTimes(0)
    })

    it('should track progress accurately during loading', async () => {
      renderWithProviders(
        <AudioNarrationWizard
          courseContent={projectData}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Should show initial progress
      await waitFor(() => {
        expect(screen.getByText(/Loading 0 of 44 files/)).toBeInTheDocument()
      })

      // Should show intermediate progress
      await waitFor(() => {
        expect(screen.getByText(/Loading \d+ of 44 files/)).toBeInTheDocument()
      })

      // Should complete
      await waitFor(() => {
        expect(screen.queryByTestId('audio-loading-overlay')).not.toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })
})