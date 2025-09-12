/**
 * SCORMPackageBuilder completion screen media count display test
 * 
 * Issue: Completion screen shows "1 Media File" when project has 4 binary files + 3 YouTube videos
 * Expected: Should show "7 Media Files" (total count including embedded URLs)
 * 
 * Root cause: UI uses mediaFilesRef.current.size (binary only) instead of total media count
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { debugLogger } from '../utils/ultraSimpleLogger'
import { structuredLogger } from '../utils/structuredLogger'
import * as rustScormGenerator from '../services/rustScormGenerator'

import { vi } from 'vitest'

// Define mock data first to avoid reference issues
const mockCourseContent = {
  welcome: {
    title: 'Welcome',
    content: 'Welcome content',
    audioId: 'audio-welcome',
    media: [
      { id: 'image-welcome-1', type: 'image' },
      { id: 'youtube-welcome-1', type: 'video' }
    ]
  },
  objectivesPage: {
    title: 'Objectives', 
    content: 'Objectives content',
    audioId: 'audio-objectives',
    media: [
      { id: 'image-objectives-1', type: 'image' }
    ]
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Topic 1 content',
      audioId: 'audio-topic-1',
      media: [
        { id: 'image-topic-1', type: 'image' },
        { id: 'youtube-topic-1', type: 'video' }
      ]
    },
    {
      id: 'topic-2', 
      title: 'Topic 2',
      content: 'Topic 2 content',
      audioId: 'audio-topic-2',
      media: [
        { id: 'image-topic-2', type: 'image' },
        { id: 'youtube-topic-2', type: 'video' }
      ]
    }
  ]
}

// Mock the storage context
const mockStorage = {
  currentProjectId: 'test-project-123',
  getCachedProject: vi.fn().mockReturnValue({
    id: 'test-project-123',
    courseContent: mockCourseContent
  }),
  saveProject: vi.fn().mockResolvedValue(undefined),
  saveCourseSeedData: vi.fn().mockResolvedValue(undefined)
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  ...vi.importActual('../contexts/PersistentStorageContext'),
  useStorage: () => mockStorage,
  PersistentStorageProvider: ({ children }: any) => children,
}))

// Mock the storage service
vi.mock('../services/FileStorage', () => ({
  createFileStorage: () => mockStorage
}))

// Mock rust SCORM generator
vi.mock('../services/rustScormGenerator', () => ({
  generateScormPackage: vi.fn()
}))

// Mock debug logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock structured logger
vi.mock('../utils/structuredLogger', () => ({
  structuredLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock notifications
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    progress: vi.fn(),
    warning: vi.fn()
  })
}))

// Mock performance monitor
vi.mock('../hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    measureAsync: vi.fn().mockImplementation(async (name, fn) => await fn())
  })
}))

// Mock media data - 4 binary files + 3 YouTube videos = 7 total
const mockAllMediaData = [
  // Binary files (will be loaded into mediaFilesRef)
  { id: 'image-welcome-1', type: 'image', blob: new Blob(['image1'], { type: 'image/jpeg' }), metadata: { mimeType: 'image/jpeg' } },
  { id: 'image-objectives-1', type: 'image', blob: new Blob(['image2'], { type: 'image/jpeg' }), metadata: { mimeType: 'image/jpeg' } },
  { id: 'image-topic-1', type: 'image', blob: new Blob(['image3'], { type: 'image/jpeg' }), metadata: { mimeType: 'image/jpeg' } },
  { id: 'image-topic-2', type: 'image', blob: new Blob(['image4'], { type: 'image/jpeg' }), metadata: { mimeType: 'image/jpeg' } },
  // YouTube videos (embedded as URLs, not loaded into mediaFilesRef)
  { id: 'youtube-welcome-1', type: 'video', metadata: { youtubeUrl: 'https://youtube.com/watch?v=abc123', mimeType: 'application/json' } },
  { id: 'youtube-topic-1', type: 'video', metadata: { youtubeUrl: 'https://youtube.com/watch?v=def456', mimeType: 'application/json' } },
  { id: 'youtube-topic-2', type: 'video', metadata: { youtubeUrl: 'https://youtube.com/watch?v=ghi789', mimeType: 'application/json' } }
]

const mockMediaContextValue = {
  getAllMedia: () => mockAllMediaData,
  getMedia: (id: string) => mockAllMediaData.find(m => m.id === id),
  getMediaForPage: (pageId: string) => mockAllMediaData.filter(m => m.id.includes(pageId)),
  createBlobUrl: (blob: Blob) => `blob:${Math.random()}`,
  storeMedia: vi.fn().mockResolvedValue('stored-id'),
  deleteMedia: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn()
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UnifiedMediaProvider value={mockMediaContextValue}>
    {children}
  </UnifiedMediaProvider>
)

describe('SCORMPackageBuilder Completion Screen Media Count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful SCORM generation
    const mockGenerateScormPackage = vi.mocked(rustScormGenerator.generateScormPackage)
    mockGenerateScormPackage.mockImplementation((content, mediaFiles, onProgress) => {
      // Simulate progress callbacks
      if (onProgress) {
        onProgress('Loading media files...', 10)
        onProgress('Generating SCORM package...', 50)
        onProgress('Finalizing package...', 90)
        onProgress('Package ready for download', 100)
      }
      
      return Promise.resolve({
        success: true,
        filePath: '/path/to/generated-package.zip',
        fileName: 'test-course.zip',
        message: 'SCORM package generated successfully'
      })
    })
  })

  it('should reproduce the issue: completion screen shows 1 Media File instead of 7 Media Files', async () => {
    console.log('=== REPRODUCING COMPLETION SCREEN COUNT ISSUE ===')
    console.log('Expected: 7 total media files (4 binary + 3 YouTube)')
    console.log('Bug: Shows only 1 Media File (binary count only)')

    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      </TestWrapper>
    )

    // Start SCORM generation
    const generateButton = screen.getByText(/Generate SCORM Package/i)
    fireEvent.click(generateButton)

    // Wait for generation to complete and success screen to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Package Ready/i)).toBeInTheDocument()
      },
      { timeout: 10000 }
    )

    console.log('Generation completed, checking completion screen...')

    // BUG: The completion screen shows mediaFilesRef.current.size (binary files only)
    // instead of total media count (binary + embedded URLs)
    
    // This test SHOULD FAIL initially, showing the bug
    const mediaCountDisplay = screen.getByText(/Media File/i)
    console.log('Media count display found:', mediaCountDisplay.textContent)

    // Check if it's showing the wrong count (1 Media File)
    const wrongCountElement = screen.queryByText('1')
    const wrongLabelElement = screen.queryByText(/^Media File$/) // Singular, not plural
    
    if (wrongCountElement && wrongLabelElement) {
      console.log('BUG REPRODUCED: Showing "1 Media File" instead of "7 Media Files"')
      
      // This assertion should FAIL, demonstrating the bug
      expect(screen.getByText('7')).toBeInTheDocument() // Should be 7 total media
      expect(screen.getByText(/Media Files/)).toBeInTheDocument() // Should be plural
      
      // Log debug info to show what's happening
      console.log('mediaFilesRef.current.size (binary only):', 1) // This is what's being shown
      console.log('getAllMedia().length (total including YouTube):', mockAllMediaData.length) // This is what SHOULD be shown
      
      fail('EXPECTED FAILURE: Completion screen shows binary file count (1) instead of total media count (7)')
    } else {
      // If the bug is already fixed, this should pass
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText(/Media Files/)).toBeInTheDocument()
      console.log('SUCCESS: Completion screen correctly shows 7 Media Files')
    }
  })

  it('should log media count calculation details for debugging', async () => {
    console.log('=== TESTING MEDIA COUNT CALCULATION DEBUG LOGGING ===')
    
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()

    render(
      <TestWrapper>
        <SCORMPackageBuilder
          courseContent={mockCourseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      </TestWrapper>
    )

    // Start generation
    const generateButton = screen.getByText(/Generate SCORM Package/i)
    fireEvent.click(generateButton)

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/Package Ready/i)).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify structured logging was called for media count analysis
    expect(structuredLogger.info).toHaveBeenCalledWith(
      'SCORM_PACKAGE',
      expect.stringContaining('media count'),
      expect.objectContaining({
        totalMedia: expect.any(Number),
        binaryFiles: expect.any(Number),
        embeddedUrls: expect.any(Number),
        mediaFilesRefSize: expect.any(Number)
      })
    )
  })
})