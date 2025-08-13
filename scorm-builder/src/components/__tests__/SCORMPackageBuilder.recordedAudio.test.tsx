import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import {
  createMockCourseContent,
  createMockNotificationContext,
  createMockUnifiedMediaContext,
  createMockStorage,
  createMockCourseSeedData,
  validateSCORMPackage
} from '../../test-utils/scorm-helpers'

// Mock Tauri APIs
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('/test/path/course.zip')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

// Mock the notification context
const mockNotifications = createMockNotificationContext()
vi.mock('../../contexts/NotificationContext', async () => {
  const actual = await vi.importActual('../../contexts/NotificationContext')
  return {
    ...actual,
    useNotifications: () => mockNotifications
  }
})

// Mock the storage context
const mockStorage = createMockStorage()
vi.mock('../../contexts/PersistentStorageContext', async () => {
  const actual = await vi.importActual('../../contexts/PersistentStorageContext')
  return {
    ...actual,
    useStorage: () => mockStorage
  }
})

// Mock unified media context
let mockUnifiedMedia = createMockUnifiedMediaContext()
vi.mock('../../contexts/UnifiedMediaContext', async () => {
  const actual = await vi.importActual('../../contexts/UnifiedMediaContext')
  return {
    ...actual,
    useUnifiedMedia: () => mockUnifiedMedia
  }
})

// Mock services
vi.mock('../../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn().mockResolvedValue({
    title: 'Test Course',
    duration: 30,
    passMark: 80,
    welcome: {
      title: 'Welcome',
      content: 'Welcome content',
      audioId: 'audio-recorded-welcome',  // Recorded audio with ID
      captionId: 'caption-recorded-welcome'
    },
    objectives: ['Learn TDD'],
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        audioId: 'audio-recorded-topic1',  // Recorded audio with ID
        captionId: 'caption-recorded-topic1',
        media: [
          { id: 'audio-recorded-topic1', type: 'audio' }  // Audio media item
        ]
      }
    ],
    assessment: { questions: [], passMark: 80 }
  })
}))

// Mock the rust generator to capture what media files are passed
let capturedMediaFiles: any[] = []
vi.mock('../../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn().mockImplementation((courseContent, projectId, onProgress, preloadedMedia) => {
    // Handle different types of preloadedMedia (Map or array)
    if (preloadedMedia && typeof preloadedMedia.entries === 'function') {
      capturedMediaFiles = Array.from(preloadedMedia.entries()).map(([filename, blob]) => ({
        filename,
        size: blob.size,
        type: blob.type
      }))
    } else if (Array.isArray(preloadedMedia)) {
      capturedMediaFiles = preloadedMedia.map(file => ({
        filename: file.filename,
        size: file.content?.length || 0,
        type: 'mock'
      }))
    } else {
      capturedMediaFiles = []
    }
    return Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]))
  })
}))

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider>
    <NotificationProvider>
      <StepNavigationProvider initialStep={4}>
        <UnifiedMediaProvider projectId="test-project">
          {children}
        </UnifiedMediaProvider>
      </StepNavigationProvider>
    </NotificationProvider>
  </PersistentStorageProvider>
)

describe('SCORMPackageBuilder - Recorded Audio Inclusion (TDD RED Phase)', () => {
  const mockCourseContent = createMockCourseContent({
    hasWelcomeAudio: true,
    hasTopicAudio: true,
    recordedAudioIds: ['audio-recorded-welcome', 'audio-recorded-topic1']
  })
  
  const mockCourseSeedData = createMockCourseSeedData()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedMediaFiles = []
    
    // Reset notification mocks
    Object.values(mockNotifications).forEach(fn => vi.mocked(fn).mockClear())
    
    // Reset unified media mock
    mockUnifiedMedia = createMockUnifiedMediaContext()
    
    // Default successful media loading
    mockInvoke.mockImplementation((cmd) => {
      switch (cmd) {
        case 'read_project_file':
          return Promise.resolve(JSON.stringify(mockCourseContent))
        case 'write_project_file':
          return Promise.resolve()
        default:
          return Promise.resolve()
      }
    })
  })

  it('should include recorded audio with standard IDs in SCORM package', async () => {
    // RED: This test will fail if recorded audio blobs are not included properly
    const user = userEvent.setup()
    
    // Mock that all audio exists in the media registry
    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
      if (id.startsWith('audio-recorded')) {
        return Promise.resolve(new Blob(['recorded audio data'], { type: 'audio/mpeg' }))
      }
      if (id.startsWith('caption-recorded')) {
        return Promise.resolve(new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nRecorded caption'], { type: 'text/vtt' }))
      }
      return Promise.resolve(new Blob(['mock data']))
    })

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent as any}
          courseSeedData={mockCourseSeedData}
        />
      </TestWrapper>
    )

    // Generate package
    const generateButton = await screen.findByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: Check that recorded audio files are included in the package
    const audioFiles = capturedMediaFiles.filter(f => f.filename.endsWith('.mp3'))
    expect(audioFiles).toHaveLength(2) // welcome + topic audio
    
    const audioFilenames = audioFiles.map(f => f.filename)
    expect(audioFilenames).toContain('audio-recorded-welcome.mp3')
    expect(audioFilenames).toContain('audio-recorded-topic1.mp3')
    
    // ASSERTION: Check that recorded caption files are included
    const captionFiles = capturedMediaFiles.filter(f => f.filename.endsWith('.vtt'))
    expect(captionFiles).toHaveLength(2) // welcome + topic captions
    
    const captionFilenames = captionFiles.map(f => f.filename)
    expect(captionFilenames).toContain('caption-recorded-welcome.vtt')
    expect(captionFilenames).toContain('caption-recorded-topic1.vtt')
  })

  it('should include recorded audio without standard IDs when stored in media registry', async () => {
    // RED: This test will fail because current implementation may not handle non-standard IDs
    const user = userEvent.setup()
    
    // Update mock converter to simulate recorded audio with non-standard ID pattern
    vi.mocked(await import('../../services/courseContentConverter')).convertToEnhancedCourseContent.mockResolvedValue({
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        // No audioId, but media array contains recorded audio
        media: [
          { id: 'media-blob-123abc', type: 'audio' }  // Non-standard ID from user recording
        ]
      },
      objectives: ['Learn TDD'],
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content',
          media: [
            { id: 'user-recording-456def', type: 'audio' }  // Another non-standard ID
          ]
        }
      ],
      assessment: { questions: [], passMark: 80 }
    })
    
    // Mock that media exists but with non-standard IDs
    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
      if (id === 'media-blob-123abc' || id === 'user-recording-456def') {
        return Promise.resolve(new Blob(['user recorded audio'], { type: 'audio/wav' }))
      }
      return Promise.resolve(null) // Other media not found
    })

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent as any}
          courseSeedData={mockCourseSeedData}
        />
      </TestWrapper>
    )

    // Generate package
    const generateButton = await screen.findByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: Check that user recorded audio is included despite non-standard IDs
    const audioFiles = capturedMediaFiles.filter(f => 
      f.filename.includes('media-blob-123abc') || 
      f.filename.includes('user-recording-456def') ||
      f.filename.endsWith('.mp3') ||
      f.filename.endsWith('.wav')
    )
    
    expect(audioFiles.length).toBeGreaterThan(0)
    console.log('Captured media files:', capturedMediaFiles)
    
    // At least one of the recorded audio files should be included
    const hasWelcomeAudio = capturedMediaFiles.some(f => 
      f.filename.includes('media-blob-123abc') || f.filename.includes('welcome')
    )
    const hasTopicAudio = capturedMediaFiles.some(f => 
      f.filename.includes('user-recording-456def') || f.filename.includes('topic')
    )
    
    expect(hasWelcomeAudio || hasTopicAudio).toBe(true)
  })

  it('should handle audio with only audioBlob (no ID) in course content', async () => {
    // RED: This test will fail because current implementation doesn't handle audioBlob without IDs
    const user = userEvent.setup()
    
    // Update mock converter to simulate audioBlob without ID
    vi.mocked(await import('../../services/courseContentConverter')).convertToEnhancedCourseContent.mockResolvedValue({
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        // No audioId, but audioBlob exists (simulating recorded audio not yet saved)
        audioBlob: new Blob(['unsaved recorded audio'], { type: 'audio/wav' })
      },
      objectives: ['Learn TDD'],
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content',
          // No audioId, but audioBlob exists
          audioBlob: new Blob(['unsaved topic audio'], { type: 'audio/wav' })
        }
      ],
      assessment: { questions: [], passMark: 80 }
    })
    
    // No media in registry since these are just blobs
    mockUnifiedMedia.getMediaBlobFromRegistry.mockResolvedValue(null)

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent as any}
          courseSeedData={mockCourseSeedData}
        />
      </TestWrapper>
    )

    // Generate package
    const generateButton = await screen.findByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: Check that audioBlob-only content is included in package
    const audioFiles = capturedMediaFiles.filter(f => 
      f.filename.endsWith('.mp3') || 
      f.filename.endsWith('.wav') ||
      f.type?.includes('audio')
    )
    
    expect(audioFiles.length).toBeGreaterThan(0)
    
    // Should have generated IDs for the audioBlob content
    const hasGeneratedAudioFiles = capturedMediaFiles.some(f => 
      f.filename.includes('audio-') && f.type?.includes('audio')
    )
    
    expect(hasGeneratedAudioFiles).toBe(true)
  })

  it('should not include missing recorded audio but should warn user', async () => {
    // RED: This test will pass but ensures proper error handling
    const user = userEvent.setup()
    
    // Mock that some recorded audio is missing from registry
    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
      if (id === 'audio-recorded-welcome') {
        return Promise.resolve(null) // Welcome audio missing
      }
      if (id === 'audio-recorded-topic1') {
        return Promise.resolve(new Blob(['topic audio data'], { type: 'audio/mpeg' }))
      }
      return Promise.resolve(new Blob(['mock data']))
    })

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent as any}
          courseSeedData={mockCourseSeedData}
        />
      </TestWrapper>
    )

    // Generate package
    const generateButton = await screen.findByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: Should only include available recorded audio
    const audioFiles = capturedMediaFiles.filter(f => f.filename.endsWith('.mp3'))
    expect(audioFiles).toHaveLength(1) // Only topic audio, not welcome
    
    const audioFilenames = audioFiles.map(f => f.filename)
    expect(audioFilenames).toContain('audio-recorded-topic1.mp3')
    expect(audioFilenames).not.toContain('audio-recorded-welcome.mp3')
    
    // ASSERTION: Should warn about missing media
    expect(mockNotifications.warning).toHaveBeenCalledWith(
      expect.stringContaining('missing')
    )
  })
})