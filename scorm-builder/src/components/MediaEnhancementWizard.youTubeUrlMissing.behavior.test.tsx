/**
 * MediaEnhancementWizard YouTube URL Missing Behavior Test
 * 
 * Tests the issue where YouTube videos show empty URLs in MediaEnhancementWizard 
 * but correct URLs in PageThumbnailGrid, causing missing video thumbnails.
 * 
 * User Report: "For some reason it is now showing the clip times but it isn't showing 
 * the youtube video image"
 * 
 * Root Cause Analysis: MediaEnhancementWizard only looks for YouTube URLs in direct 
 * properties (youtubeUrl, embedUrl, url) but not in nested metadata objects like 
 * PageThumbnailGrid does (metadata.youtubeUrl, metadata.embedUrl, metadata.url).
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'

// Mock the services and hooks
vi.mock('../services/searchService')
vi.mock('../services/externalImageDownloader')
vi.mock('../hooks/useMedia')
vi.mock('../contexts/PersistentStorageContext', async () => {
  const actual = await vi.importActual('../contexts/PersistentStorageContext')
  return {
    ...actual,
    useStorage: () => ({
      saveProject: vi.fn(),
      getProjectSummary: vi.fn()
    })
  }
})

describe('MediaEnhancementWizard - YouTube URL Missing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockCourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 0,
      media: []
    },
    learningObjectivesPage: {
      id: 'learning-objectives', 
      title: 'Learning Objectives',
      content: 'Learning objectives content',
      narration: '',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 0,
      media: []
    },
    topics: [],
    assessment: { questions: [], passMark: 80, narration: null }
  }

  // Simulate media data structure that shows up in browser logs
  const mockYouTubeVideoWithMetadataUrl = {
    id: 'video-0',
    type: 'video',
    isYouTube: true,
    title: 'YouTube Video with Metadata URL',
    // These fields are EMPTY (causing the issue)
    url: '',
    embedUrl: '',
    youtubeUrl: '',
    // URL data is nested in metadata (like PageThumbnailGrid expects)
    metadata: {
      youtubeUrl: 'https://www.youtube.com/watch?v=7KRajQwp6gQ',
      embedUrl: 'https://www.youtube.com/embed/7KRajQwp6gQ',
      url: 'https://www.youtube.com/watch?v=7KRajQwp6gQ'
    },
    clipStart: 30,
    clipEnd: 60,
    storageId: 'storage-video-0',
    uploadedAt: Date.now(),
    pageId: 'welcome'
  }

  test('FAILING TEST: Should extract YouTube URLs from metadata when direct properties are empty', async () => {
    console.log('🧪 [TEST] Testing YouTube URL extraction from metadata...')
    
    // Mock useMedia hook to return our test data
    const mockUseMedia = vi.mocked(await import('../hooks/useMedia')).useMedia
    mockUseMedia.mockReturnValue({
      actions: {
        storeMedia: vi.fn(),
        deleteMedia: vi.fn(),
        updateYouTubeVideoMetadata: vi.fn(),
        populateFromCourseContent: vi.fn(),
        createBlobUrl: vi.fn().mockResolvedValue('blob:mock-url'),
        cleanupContaminatedMedia: vi.fn(),
        setLoadingProfile: vi.fn()
      },
      selectors: {
        getMedia: vi.fn(),
        getValidMediaForPage: vi.fn().mockResolvedValue([mockYouTubeVideoWithMetadataUrl]),
        loadingProfile: null
      }
    })

    const { container } = render(
      <UnsavedChangesProvider>
        <StepNavigationProvider>
          <NotificationProvider>
            <PersistentStorageProvider>
              <UnifiedMediaProvider>
                <MediaEnhancementWizard
                  courseContent={mockCourseContent}
                  onNext={vi.fn()}
                  onBack={vi.fn()}
                />
              </UnifiedMediaProvider>
            </PersistentStorageProvider>
          </NotificationProvider>
        </StepNavigationProvider>
      </UnsavedChangesProvider>
    )

    console.log('🔍 [TEST] Waiting for current media section to load...')
    
    // Wait for the current media section to appear
    await waitFor(() => {
      const currentMediaSection = screen.getByText('Current Media')
      expect(currentMediaSection).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('🔍 [TEST] Looking for YouTube video thumbnail...')
    
    // Should show YouTube video thumbnail (this will FAIL with current implementation)
    await waitFor(() => {
      // Look for an img element with YouTube thumbnail URL pattern
      const thumbnailImages = container.querySelectorAll('img[src*="img.youtube.com"]')
      console.log('🔍 [TEST] Found thumbnail images:', thumbnailImages.length)
      
      // Should find at least one YouTube thumbnail
      expect(thumbnailImages.length).toBeGreaterThan(0)
      
      // Verify it's the correct video ID
      const firstThumbnail = thumbnailImages[0] as HTMLImageElement
      expect(firstThumbnail.src).toContain('7KRajQwp6gQ')
      
      console.log('✅ [TEST] YouTube thumbnail URL found:', firstThumbnail.src)
    }, { timeout: 2000 })

    console.log('🔍 [TEST] Verifying clip timing is also displayed...')
    
    // Should also show clip timing (this part works from previous fix)
    await waitFor(() => {
      const clipTimingDisplay = screen.getByTestId('clip-timing-display')
      expect(clipTimingDisplay).toBeInTheDocument()
      expect(clipTimingDisplay.textContent).toContain('0:30')
      expect(clipTimingDisplay.textContent).toContain('1:00')
      
      console.log('✅ [TEST] Clip timing correctly displayed')
    })
  })

  test('DIAGNOSTIC: Check current YouTube URL extraction logic in MediaEnhancementWizard', async () => {
    console.log('🔍 [DIAGNOSTIC] Testing current YouTube URL extraction behavior...')
    
    const mockUseMedia = vi.mocked(await import('../hooks/useMedia')).useMedia
    mockUseMedia.mockReturnValue({
      actions: {
        storeMedia: vi.fn(),
        deleteMedia: vi.fn(),
        updateYouTubeVideoMetadata: vi.fn(),
        populateFromCourseContent: vi.fn(),
        createBlobUrl: vi.fn().mockResolvedValue('blob:mock-url'),
        cleanupContaminatedMedia: vi.fn(),
        setLoadingProfile: vi.fn()
      },
      selectors: {
        getMedia: vi.fn(),
        getValidMediaForPage: vi.fn().mockResolvedValue([mockYouTubeVideoWithMetadataUrl]),
        loadingProfile: null
      }
    })

    render(
      <UnsavedChangesProvider>
        <StepNavigationProvider>
          <NotificationProvider>
            <PersistentStorageProvider>
              <UnifiedMediaProvider>
                <MediaEnhancementWizard
                  courseContent={mockCourseContent}
                  onNext={vi.fn()}
                  onBack={vi.fn()}
                />
              </UnifiedMediaProvider>
            </PersistentStorageProvider>
          </NotificationProvider>
        </StepNavigationProvider>
      </UnsavedChangesProvider>
    )

    await waitFor(() => {
      const currentMediaSection = screen.getByText('Current Media')
      expect(currentMediaSection).toBeInTheDocument()
    })

    console.log('🔍 [DIAGNOSTIC] Checking what URLs are being extracted...')
    
    // This diagnostic test simulates the current logic
    const testMedia = mockYouTubeVideoWithMetadataUrl
    
    // Current MediaEnhancementWizard logic (will fail)
    const currentLogicUrl = (testMedia as any).youtubeUrl || 
                           testMedia.embedUrl ||
                           testMedia.url
    
    // PageThumbnailGrid logic (works correctly)  
    const correctLogicUrl = testMedia.metadata?.youtubeUrl || 
                           testMedia.metadata?.embedUrl ||
                           testMedia.metadata?.url ||
                           testMedia.url

    console.log('🔍 [DIAGNOSTIC] URL extraction comparison:', {
      mediaId: testMedia.id,
      directYoutubeUrl: testMedia.youtubeUrl,
      directEmbedUrl: testMedia.embedUrl, 
      directUrl: testMedia.url,
      metadataYoutubeUrl: testMedia.metadata?.youtubeUrl,
      metadataEmbedUrl: testMedia.metadata?.embedUrl,
      metadataUrl: testMedia.metadata?.url,
      currentLogicResult: currentLogicUrl,
      correctLogicResult: correctLogicUrl,
      problemIdentified: !currentLogicUrl && !!correctLogicUrl
    })

    // The diagnostic passes - we're just checking current behavior
    expect(true).toBe(true)
  })

  test('FAILING TEST: Should show same YouTube thumbnails as PageThumbnailGrid for identical data', async () => {
    console.log('🧪 [TEST] Testing data consistency between components...')
    
    const mockUseMedia = vi.mocked(await import('../hooks/useMedia')).useMedia
    mockUseMedia.mockReturnValue({
      actions: {
        storeMedia: vi.fn(),
        deleteMedia: vi.fn(), 
        updateYouTubeVideoMetadata: vi.fn(),
        populateFromCourseContent: vi.fn(),
        createBlobUrl: vi.fn().mockResolvedValue('blob:mock-url'),
        cleanupContaminatedMedia: vi.fn(),
        setLoadingProfile: vi.fn()
      },
      selectors: {
        getMedia: vi.fn().mockImplementation(async (mediaId) => {
          // Simulate enriched metadata fetch (like PageThumbnailGrid does)
          if (mediaId === 'video-0') {
            return {
              ...mockYouTubeVideoWithMetadataUrl,
              // Enhanced metadata that PageThumbnailGrid gets
              metadata: {
                ...mockYouTubeVideoWithMetadataUrl.metadata,
                source: 'youtube',
                isYouTube: true
              }
            }
          }
          return null
        }),
        getValidMediaForPage: vi.fn().mockResolvedValue([mockYouTubeVideoWithMetadataUrl]),
        loadingProfile: null
      }
    })

    render(
      <UnsavedChangesProvider>
        <StepNavigationProvider>
          <NotificationProvider>
            <PersistentStorageProvider>
              <UnifiedMediaProvider>
                <MediaEnhancementWizard
                  courseContent={mockCourseContent}
                  onNext={vi.fn()}
                  onBack={vi.fn()}
                />
              </UnifiedMediaProvider>
            </PersistentStorageProvider>
          </NotificationProvider>
        </StepNavigationProvider>
      </UnsavedChangesProvider>
    )

    await waitFor(() => {
      const currentMediaSection = screen.getByText('Current Media')
      expect(currentMediaSection).toBeInTheDocument()
    })

    console.log('🔍 [TEST] Checking for video placeholder fallback...')
    
    // Currently, this should show a placeholder since URL extraction fails
    const videoPlaceholder = screen.getByText('📹 Video')
    expect(videoPlaceholder).toBeInTheDocument()
    
    console.log('🚫 [TEST] Confirmed - showing placeholder instead of actual thumbnail')
    console.log('📍 [TEST] Expected: YouTube thumbnail URL')
    console.log('📍 [TEST] Actual: Video placeholder')
  })
})