import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import {
  createMockNotificationContext,
  createMockUnifiedMediaContext,
  createMockStorage,
  createMockCourseSeedData
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

// Mock contexts
const mockNotifications = createMockNotificationContext()
vi.mock('../../contexts/NotificationContext', async () => {
  const actual = await vi.importActual('../../contexts/NotificationContext')
  return {
    ...actual,
    useNotifications: () => mockNotifications
  }
})

const mockStorage = createMockStorage()
vi.mock('../../contexts/PersistentStorageContext', async () => {
  const actual = await vi.importActual('../../contexts/PersistentStorageContext')
  return {
    ...actual,
    useStorage: () => mockStorage
  }
})

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
      media: [
        { id: 'shared-media-id', type: 'image' },
        { id: 'shared-media-id', type: 'video' }  // Duplicate ID, different type
      ]
    },
    objectives: ['Learn TDD'],
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        media: [
          { id: 'shared-media-id', type: 'audio' },  // Same ID again, different type
          { id: 'unique-media-id', type: 'image' }
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
    if (preloadedMedia && typeof preloadedMedia.entries === 'function') {
      capturedMediaFiles = Array.from(preloadedMedia.entries()).map(([filename, blob]) => ({
        filename,
        size: blob.size,
        type: blob.type
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

describe('SCORMPackageBuilder - Duplicate Media ID Handling (TDD RED Phase)', () => {
  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<h1>Welcome to the course</h1>',
      narration: 'Welcome to this training course',
      media: [
        { id: 'shared-media-id', type: 'image' },
        { id: 'shared-media-id', type: 'video' }
      ]
    },
    topics: [
      {
        id: 'topic-1',
        title: 'First Topic',
        content: '<h2>Topic Content</h2>',
        narration: 'This is the first topic',
        media: [
          { id: 'shared-media-id', type: 'audio' },
          { id: 'unique-media-id', type: 'image' }
        ]
      }
    ],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }
  
  const mockCourseSeedData = createMockCourseSeedData()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedMediaFiles = []
    
    Object.values(mockNotifications).forEach(fn => vi.mocked(fn).mockClear())
    mockUnifiedMedia = createMockUnifiedMediaContext()
    
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

  it('should handle same media ID with different types without overwriting', async () => {
    // RED: This test will fail if duplicate IDs overwrite each other
    const user = userEvent.setup()
    
    // Mock different media for the same ID based on context
    mockUnifiedMedia.getMedia.mockImplementation((id: string) => {
      if (id === 'shared-media-id') {
        // All calls with same ID should get the same data - the uniqueness comes from different filenames
        return Promise.resolve({
          data: new Uint8Array([1, 2, 3]),
          mimeType: 'application/octet-stream',
          metadata: { mimeType: 'application/octet-stream' }
        })
      }
      if (id === 'unique-media-id') {
        return Promise.resolve({
          data: new Uint8Array([4, 5, 6]),
          mimeType: 'image/jpeg',
          metadata: { mimeType: 'image/jpeg' }
        })
      }
      return Promise.resolve({
        data: new Uint8Array([7, 8, 9]),
        mimeType: 'application/octet-stream',
        metadata: { mimeType: 'application/octet-stream' }
      })
    })

    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
      if (id === 'shared-media-id') {
        return Promise.resolve(new Blob(['media content'], { type: 'application/octet-stream' }))
      }
      if (id === 'unique-media-id') {
        return Promise.resolve(new Blob(['unique content'], { type: 'image/jpeg' }))
      }
      return Promise.resolve(new Blob(['default content']))
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

    // ASSERTION: Should have different files for different types even with same ID
    const mediaFiles = capturedMediaFiles.filter(f => f.filename.includes('shared-media-id'))
    
    // Should have entries for different extensions: .jpg, .mp4, .mp3
    expect(mediaFiles.length).toBeGreaterThan(1)
    
    // Filenames should be unique to prevent overwrites
    const filenames = capturedMediaFiles.map(f => f.filename)
    const uniqueFilenames = new Set(filenames)
    expect(uniqueFilenames.size).toBe(filenames.length) // No duplicate filenames
    
    console.log('Captured media files:', capturedMediaFiles)
  })

  it('should generate unique filenames for duplicate IDs', async () => {
    // RED: This test will fail if the current implementation doesn't prevent overwrites
    const user = userEvent.setup()
    
    mockUnifiedMedia.getMedia.mockResolvedValue({
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'application/octet-stream',
      metadata: { mimeType: 'application/octet-stream' }
    })

    mockUnifiedMedia.getMediaBlobFromRegistry.mockResolvedValue(
      new Blob(['media data'], { type: 'application/octet-stream' })
    )

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

    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: All filenames should be unique
    const filenames = capturedMediaFiles.map(f => f.filename)
    const uniqueFilenames = new Set(filenames)
    
    expect(uniqueFilenames.size).toBe(filenames.length)
    
    // Should have multiple entries for the shared ID
    const sharedIdFiles = filenames.filter(f => f.includes('shared-media-id'))
    expect(sharedIdFiles.length).toBeGreaterThan(1)
    
    // Each should be unique (e.g., shared-media-id.jpg, shared-media-id-video.mp4, shared-media-id-audio.mp3)
    const uniqueSharedIdFiles = new Set(sharedIdFiles)
    expect(uniqueSharedIdFiles.size).toBe(sharedIdFiles.length)
  })
})