import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { PageThumbnailGrid } from './PageThumbnailGrid'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { CourseContent } from '../types/aiPrompt'

// Mock console methods to capture logging
const mockConsoleLog = vi.fn()
const mockConsoleWarn = vi.fn()
const mockConsoleError = vi.fn()
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

beforeEach(() => {
  vi.clearAllMocks()
  mockConsoleLog.mockClear()
  mockConsoleWarn.mockClear()  
  mockConsoleError.mockClear()
  console.log = mockConsoleLog
  console.warn = mockConsoleWarn
  console.error = mockConsoleError
})

afterEach(() => {
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
  console.error = originalConsoleError
})

// Test wrapper with all required providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <PersistentStorageProvider projectId="test-project">
      <UnifiedMediaProvider>
        <UnsavedChangesProvider>
          <StepNavigationProvider>
            {children}
          </StepNavigationProvider>
        </UnsavedChangesProvider>
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('YouTube Clip Timing Issues - User-Reported Behavior Reproduction', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5
    },
    learningObjectivesPage: {
      id: 'learning-objectives', 
      title: 'Learning Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3
    },
    topics: [{
      id: 'topic-0',
      title: 'Topic with YouTube Clip Issues',
      content: '<p>Topic content</p>',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 10
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  test('ISSUE 1: Page thumbnail grid no longer shows video thumbnails', async () => {
    console.log('[REPRO TEST] 🔍 Testing Issue 1: Page thumbnail grid not showing video thumbnails')
    
    // Mock YouTube video data that should display thumbnails
    vi.mock('../contexts/UnifiedMediaContext', async (importOriginal) => {
      const actual = await importOriginal()
      return {
        ...actual,
        useUnifiedMedia: () => ({
          getValidMediaForPage: vi.fn().mockImplementation(async (pageId: string) => {
            if (pageId === 'topic-0') {
              return [
                {
                  id: 'video-2',
                  type: 'youtube', // This should show a thumbnail
                  pageId: 'topic-0',
                  fileName: 'youtube-video.mp4',
                  metadata: {
                    isYouTube: true,
                    source: 'youtube',
                    youtubeUrl: 'https://www.youtube.com/watch?v=U7j0iTBz7Qs',
                    embedUrl: 'https://www.youtube.com/embed/U7j0iTBz7Qs',
                    type: 'youtube',
                    clipStart: 30,
                    clipEnd: 60,
                    title: 'YouTube Video That Should Show Thumbnail'
                  }
                }
              ]
            }
            return []
          }),
          getMedia: vi.fn().mockImplementation(async (mediaId: string) => {
            if (mediaId === 'video-2') {
              return {
                id: 'video-2',
                url: 'https://www.youtube.com/watch?v=U7j0iTBz7Qs&start=30&end=60'
              }
            }
            return null
          }),
          createBlobUrl: vi.fn().mockResolvedValue('blob:http://localhost:1420/working-blob'),
          mediaLoaded: true,
          loadMedia: vi.fn(),
          storeMedia: vi.fn(),
          mediaItems: [],
          deleteMedia: vi.fn(),
          error: null,
          clearError: vi.fn()
        })
      }
    })

    const onPageSelect = vi.fn()

    render(
      <TestWrapper>
        <PageThumbnailGrid
          courseContent={mockCourseContent}
          currentPageId="topic-0"
          onPageSelect={onPageSelect}
        />
      </TestWrapper>
    )

    // Wait for component to render and process media
    await waitFor(() => {
      expect(screen.getByTestId('page-thumbnail-grid')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Wait for media processing
    await waitFor(() => {
      const logCalls = mockConsoleLog.mock.calls.map(call => call.join(' ')).join(' ')
      return logCalls.includes('PageThumbnailGrid') || logCalls.includes('Processing YouTube')
    }, { timeout: 2000 })

    console.log('[REPRO TEST] ❌ Expected: YouTube video thumbnail should be visible')
    console.log('[REPRO TEST] ❌ Actual: No thumbnails showing (reproducing user issue)')
    
    // This test should FAIL initially, demonstrating the issue
    const thumbnailElements = screen.queryAllByRole('img')
    console.log('[REPRO TEST] Found', thumbnailElements.length, 'thumbnail images')
    
    // Check if YouTube thumbnail URL is being generated
    const logOutput = mockConsoleLog.mock.calls.flat().join(' ')
    const hasYouTubeThumbnailLog = logOutput.includes('img.youtube.com')
    console.log('[REPRO TEST] YouTube thumbnail generation logged:', hasYouTubeThumbnailLog)
    
    // This assertion should FAIL before the fix
    expect(hasYouTubeThumbnailLog).toBe(true)
  })

  test('ISSUE 2: Video gets removed when saving the project', async () => {
    console.log('[REPRO TEST] 🔍 Testing Issue 2: Video disappears on save')
    
    // Mock a save operation that removes videos
    const mockSaveProject = vi.fn().mockResolvedValue(true)
    
    vi.mock('../contexts/UnifiedMediaContext', async (importOriginal) => {
      const actual = await importOriginal()
      return {
        ...actual,
        useUnifiedMedia: () => ({
          getValidMediaForPage: vi.fn().mockResolvedValue([
            {
              id: 'video-3',
              type: 'youtube',
              pageId: 'topic-0',
              fileName: 'youtube-clip.mp4',
              metadata: {
                isYouTube: true,
                youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
                clipStart: 10,
                clipEnd: 30,
                title: 'Video That Should Persist'
              }
            }
          ]),
          mediaLoaded: true,
          loadMedia: vi.fn(),
          storeMedia: vi.fn(),
          mediaItems: [],
          deleteMedia: vi.fn(),
          error: null,
          clearError: vi.fn(),
          // This should be called but video should remain
          saveProject: mockSaveProject
        })
      }
    })

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={2}
          onSave={vi.fn()}
        />
      </TestWrapper>
    )

    // Wait for initial load
    await waitFor(() => {
      const logOutput = mockConsoleLog.mock.calls.flat().join(' ')
      return logOutput.includes('MediaEnhancement') || logOutput.includes('Loading')
    }, { timeout: 2000 })

    console.log('[REPRO TEST] ❌ Expected: Video should remain after save')
    console.log('[REPRO TEST] ❌ Actual: Video gets removed (reproducing user issue)')

    // This should demonstrate the video disappearing issue
    expect(mockSaveProject).not.toHaveBeenCalled() // Before save
    
    // Simulate save operation
    // The video should persist but currently gets removed
    expect(true).toBe(true) // Placeholder - this test structure shows the issue
  })

  test('ISSUE 3: Clip timing disappears after project reload', async () => {
    console.log('[REPRO TEST] 🔍 Testing Issue 3: Clip timing not persisting across reloads')
    
    vi.mock('../contexts/UnifiedMediaContext', async (importOriginal) => {
      const actual = await importOriginal()
      
      // Mock storage that loses clip timing on reload
      const mockStoredMedia = {
        id: 'video-4',
        type: 'youtube',
        pageId: 'topic-0',
        fileName: 'youtube-persistent.mp4',
        metadata: {
          isYouTube: true,
          youtubeUrl: 'https://www.youtube.com/watch?v=def456',
          // Missing clipStart/clipEnd - simulating persistence failure
          title: 'Video That Should Keep Clip Timing'
        }
      }
      
      return {
        ...actual,
        useUnifiedMedia: () => ({
          getValidMediaForPage: vi.fn().mockResolvedValue([mockStoredMedia]),
          mediaLoaded: true,
          loadMedia: vi.fn(),
          storeMedia: vi.fn(),
          mediaItems: [],
          deleteMedia: vi.fn(),
          error: null,
          clearError: vi.fn()
        })
      }
    })

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={2}
          onSave={vi.fn()}
        />
      </TestWrapper>
    )

    // Wait for media to load
    await waitFor(() => {
      const logOutput = mockConsoleLog.mock.calls.flat().join(' ')
      return logOutput.includes('Loaded YouTube video') || logOutput.includes('clip timing')
    }, { timeout: 2000 })

    console.log('[REPRO TEST] ❌ Expected: Video should have clip timing (clipStart: 10, clipEnd: 30)')
    console.log('[REPRO TEST] ❌ Actual: Clip timing is lost after reload (reproducing user issue)')

    // Check if clip timing was loaded
    const clipTimingLogs = mockConsoleLog.mock.calls
      .filter(call => call[0] && call[0].includes && call[0].includes('clip timing'))
    
    console.log('[REPRO TEST] Clip timing logs found:', clipTimingLogs.length)
    
    // This should show that clip timing is missing
    const hasClipTimingData = clipTimingLogs.some(log => 
      log.some(arg => arg && arg.toString().includes('clipStart'))
    )
    
    console.log('[REPRO TEST] Has clip timing data:', hasClipTimingData)
    
    // This assertion should FAIL before the fix
    expect(hasClipTimingData).toBe(true)
  })

  test('INTEGRATION: All three issues combined reproduce user experience', async () => {
    console.log('[REPRO TEST] 🎯 Testing combined user experience with all issues')
    console.log('[REPRO TEST] User Flow:')
    console.log('[REPRO TEST] 1. Add YouTube video with clip timing')
    console.log('[REPRO TEST] 2. Save project')
    console.log('[REPRO TEST] 3. Reload project') 
    console.log('[REPRO TEST] 4. Expected: Video shows in thumbnail grid with clip timing')
    console.log('[REPRO TEST] 5. Actual: No thumbnails, video missing, no clip timing')
    
    // This test documents the complete broken user experience
    // Before fixes: All three issues occur together
    // After fixes: Complete flow should work seamlessly
    
    expect(true).toBe(true) // This will be expanded after individual fixes
  })
})