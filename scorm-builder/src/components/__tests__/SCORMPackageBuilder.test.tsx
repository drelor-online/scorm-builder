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
  createMockMediaFiles,
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
      audioId: 'audio-welcome-123',
      captionId: 'caption-welcome-123'
    },
    objectives: ['Learn TDD'],
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content',
        audioId: 'audio-topic-456',
        captionId: 'caption-topic-456',
        media: [
          { id: 'audio-topic-456', type: 'audio' }
        ]
      }
    ],
    assessment: { questions: [], passMark: 80 }
  })
}))

vi.mock('../../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]))
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

describe('SCORMPackageBuilder - Notification Timing (TDD RED Phase)', () => {
  const mockCourseContent = createMockCourseContent({
    hasWelcomeAudio: true,
    hasTopicAudio: true,
    recordedAudioIds: ['audio-welcome-123', 'audio-topic-456']
  })
  
  const mockCourseSeedData = createMockCourseSeedData()

  beforeEach(() => {
    vi.clearAllMocks()
    
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

  it('should NOT show success notification when media loading fails', async () => {
    // RED: This test will fail because current implementation shows success regardless of failed media
    const user = userEvent.setup()
    
    // Update the shared mock to simulate failed media loading - mock the getMedia function
    mockUnifiedMedia.getMedia.mockImplementation((id: string) => {
      if (id === 'audio-topic-456' || id === 'caption-topic-456') {
        return Promise.resolve(null) // Simulate missing media
      }
      return Promise.resolve({
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/mpeg',
        metadata: { mimeType: 'audio/mpeg' }
      })
    })

    // Also mock getMediaBlobFromRegistry for consistency
    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
      if (id === 'audio-topic-456' || id === 'caption-topic-456') {
        return Promise.resolve(null) // Simulate missing media
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

    // Find and click generate button (button, not heading)
    const generateButton = await screen.findByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: Success should NOT be called when media is missing
    expect(mockNotifications.success).not.toHaveBeenCalledWith('SCORM package generated successfully!')
    
    // ASSERTION: Warning should be shown instead
    expect(mockNotifications.warning).toHaveBeenCalledWith(
      expect.stringContaining('missing')
    )
  })

  it('should show success notification only when all media loads successfully', async () => {
    // RED: This test will pass initially but ensures we maintain correct behavior
    const user = userEvent.setup()
    
    // Update the shared mock - all media loads successfully
    mockUnifiedMedia.getMedia.mockImplementation((id: string) => {
      return Promise.resolve({
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/mpeg',
        metadata: { mimeType: 'audio/mpeg' }
      })
    })

    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
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

    // Find and click generate button (button, not heading)
    const generateButton = await screen.findByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Generating package/)).not.toBeInTheDocument()
    }, { timeout: 10000 })

    // ASSERTION: Success should be called when all media loads
    expect(mockNotifications.success).toHaveBeenCalledWith('SCORM package generated successfully!')
    
    // ASSERTION: Warning should NOT be called
    expect(mockNotifications.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('missing')
    )
  })

  it('should delay success notification until after download completion', async () => {
    // RED: This test will fail because current implementation shows success immediately after generation
    const user = userEvent.setup()
    
    // Update the shared mock - all media loads successfully
    mockUnifiedMedia.getMedia.mockImplementation((id: string) => {
      return Promise.resolve({
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/mpeg',
        metadata: { mimeType: 'audio/mpeg' }
      })
    })

    mockUnifiedMedia.getMediaBlobFromRegistry.mockResolvedValue(new Blob(['mock data']))

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

    // Clear previous calls to track what happens after download
    mockNotifications.success.mockClear()

    // Now download the package
    const downloadButton = await screen.findByRole('button', { name: /Download SCORM Package/i })
    await user.click(downloadButton)

    // Wait for download to complete
    await waitFor(() => {
      expect(screen.queryByText(/Downloading/)).not.toBeInTheDocument()
    }, { timeout: 5000 })

    // ASSERTION: Success notification should appear after download, not just generation
    expect(mockNotifications.success).toHaveBeenCalledWith(
      'SCORM package saved to: /test/path/course.zip'
    )
  })

  it('should count failed media correctly and reflect in notification', async () => {
    // RED: This test will fail because current implementation doesn't count failed media properly
    const user = userEvent.setup()
    
    // Update the shared mock - simulate multiple media failures
    mockUnifiedMedia.getMedia.mockImplementation((id: string) => {
      // Simulate 2 out of 4 media files failing
      if (id.includes('topic-456') || id.includes('caption-welcome')) {
        return Promise.resolve(null)
      }
      return Promise.resolve({
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/mpeg',
        metadata: { mimeType: 'audio/mpeg' }
      })
    })

    mockUnifiedMedia.getMediaBlobFromRegistry.mockImplementation((id: string) => {
      // Simulate 2 out of 4 media files failing
      if (id.includes('topic-456') || id.includes('caption-welcome')) {
        return Promise.resolve(null)
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

    // ASSERTION: Warning should specify exact number of missing files
    expect(mockNotifications.warning).toHaveBeenCalledWith(
      'Package generated with 3 missing media files'
    )
    
    // ASSERTION: Success should not be called
    expect(mockNotifications.success).not.toHaveBeenCalledWith('SCORM package generated successfully!')
  })
})