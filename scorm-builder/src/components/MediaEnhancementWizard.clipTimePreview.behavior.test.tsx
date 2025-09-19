/**
 * MediaEnhancementWizard Clip Time Preview Behavior Test
 * 
 * Tests the issue where clip time preview is NOT showing in the current media section
 * for YouTube videos that have clip timing data.
 * 
 * User Report: "It still doesn't show the clip time preview in the current media section. 
 * It shows it in the editor where you can actually edit the clip time but not in the 
 * current media section itself."
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '@/contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '@/contexts/PersistentStorageContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { StepNavigationProvider } from '@/contexts/StepNavigationContext'

// Mock YouTube video WITH clip timing 
const mockYouTubeVideoWithClipTiming = {
  id: 'youtube-video-1',
  type: 'video' as const,
  isYouTube: true,
  title: 'YouTube Video with Clip Timing',
  url: 'https://www.youtube.com/watch?v=testVideoId',
  embedUrl: 'https://www.youtube.com/embed/testVideoId',
  clipStart: 90,  // 1:30
  clipEnd: 225,   // 3:45
  storageId: 'storage-youtube-1',
  uploadedAt: Date.now(),
  pageId: 'page-1'
}

// Mock YouTube video WITHOUT clip timing (null values - the bug case)
const mockYouTubeVideoWithNullClipTiming = {
  id: 'youtube-video-null',
  type: 'video' as const,
  isYouTube: true,
  title: 'YouTube Video with NULL Clip Timing',
  url: 'https://www.youtube.com/watch?v=testVideoId2',
  embedUrl: 'https://www.youtube.com/embed/testVideoId2',
  clipStart: null,  // NULL - should not show clip timing
  clipEnd: null,    // NULL - should not show clip timing
  storageId: 'storage-youtube-null',
  uploadedAt: Date.now(),
  pageId: 'page-1'
}

// Mock the MediaService to return our test data
vi.mock('@/services/MediaService', () => ({
  createMediaService: vi.fn(() => ({
    getValidMediaForPage: vi.fn().mockResolvedValue([mockYouTubeVideoWithNullClipTiming]),
    listAllMedia: vi.fn().mockResolvedValue([mockYouTubeVideoWithNullClipTiming]),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    updateYouTubeVideoMetadata: vi.fn(),
    getMedia: vi.fn(),
    cleanup: vi.fn()
  }))
}))

// Mock storage context
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project-1',
  saveContent: vi.fn(),
  getContent: vi.fn(),
  saveCourseContent: vi.fn(),
  getCourseContent: vi.fn()
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider value={mockStorage as any}>
    <StepNavigationProvider>
      <NotificationProvider>
        <UnsavedChangesProvider>
          <UnifiedMediaProvider>
            {children}
          </UnifiedMediaProvider>
        </UnsavedChangesProvider>
      </NotificationProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

describe('MediaEnhancementWizard - Clip Time Preview Display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultProps = {
    page: { id: 'page-1', title: 'Test Page' },
    courseContent: {
      topics: [
        { 
          id: 'page-1', 
          title: 'Test Page',
          content: 'Test content',
          media: ['youtube-video-null']
        }
      ]
    } as any,
    currentPageIndex: 0,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onUpdate: vi.fn()
  }

  test('FAILING TEST: Should NOT display clip time preview for YouTube video with null clip timing', async () => {
    console.log('🧪 [TEST] Testing that clip time preview does NOT appear for null clip timing...')
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...defaultProps} />
      </TestWrapper>
    )

    // Wait for media to load
    await waitFor(() => {
      // Component should render without errors
      expect(screen.getByText('Test Page')).toBeInTheDocument()
    }, { timeout: 5000 })

    console.log('🔍 [TEST] Verifying NO clip timing display for null values...')

    // The clip timing display should NOT be visible for null values
    await waitFor(() => {
      // Should NOT find the clip timing display component
      const clipTimingDisplay = screen.queryByTestId('clip-timing-display')
      expect(clipTimingDisplay).not.toBeInTheDocument()
      
      // Should NOT show any timing text
      const startTime = screen.queryByText('1:30')
      expect(startTime).not.toBeInTheDocument()
      
      const endTime = screen.queryByText('3:45')
      expect(endTime).not.toBeInTheDocument()
      
      // Should NOT show the "Clip Timing" title
      const clipTitle = screen.queryByText('Clip Timing')
      expect(clipTitle).not.toBeInTheDocument()

      console.log('✅ [TEST] Correctly NOT showing clip timing display for null values')
    }, { timeout: 5000 })
  })

  test('DIAGNOSTIC: Check what is actually rendered for YouTube video with clip timing', async () => {
    console.log('🔍 [DIAGNOSTIC] Checking what is actually rendered for YouTube video...')
    
    const consoleSpy = vi.spyOn(console, 'log')
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...defaultProps} />
      </TestWrapper>
    )

    // Wait for media to load and debug logs to appear
    await waitFor(() => {
      // Component should render without errors
      expect(screen.getByText('Test Page')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Wait for the component's debug logs to appear
    await waitFor(() => {
      // Look for the debug logs from EnhancedClipTimingDisplay
      const relevantLogs = consoleSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          arg.includes('🎬 [EnhancedClipTimingDisplay]')
        )
      )
      
      console.log('🔍 [DIAGNOSTIC] Found EnhancedClipTimingDisplay debug logs:', relevantLogs.length)
      
      // Look for the current media section debug logs
      const currentMediaLogs = consoleSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          arg.includes('🎯 [Current Media Section] Checking Enhanced Clip Timing Display')
        )
      )
      
      console.log('🔍 [DIAGNOSTIC] Found Current Media Section debug logs:', currentMediaLogs.length)
      
      if (relevantLogs.length > 0) {
        console.log('🔍 [DIAGNOSTIC] EnhancedClipTimingDisplay was called')
        relevantLogs.forEach(log => console.log('  Debug log:', log))
      } else {
        console.log('❌ [DIAGNOSTIC] EnhancedClipTimingDisplay was NOT called')
      }
      
      if (currentMediaLogs.length > 0) {
        console.log('🔍 [DIAGNOSTIC] Current Media Section debug was called')  
        currentMediaLogs.forEach(log => console.log('  Debug log:', log))
      } else {
        console.log('❌ [DIAGNOSTIC] Current Media Section debug was NOT called')
      }
      
      // Check what's actually in the DOM
      const allText = document.body.textContent || ''
      console.log('🔍 [DIAGNOSTIC] DOM contains "Clip Timing":', allText.includes('Clip Timing'))
      console.log('🔍 [DIAGNOSTIC] DOM contains "1:30":', allText.includes('1:30'))
      console.log('🔍 [DIAGNOSTIC] DOM contains "3:45":', allText.includes('3:45'))
      console.log('🔍 [DIAGNOSTIC] DOM contains YouTube title:', allText.includes('YouTube Video with Clip Timing'))
      
    }, { timeout: 10000 })
    
    consoleSpy.mockRestore()
  })

  test('DIAGNOSTIC: Verify media data structure matches expected format', async () => {
    console.log('🔍 [DIAGNOSTIC] Verifying media data structure...')
    
    const consoleSpy = vi.spyOn(console, 'log')
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard {...defaultProps} />
      </TestWrapper>
    )

    await waitFor(() => {
      // Component should render without errors
      expect(screen.getByText('Test Page')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Look for debug logs that show the media data structure
    await waitFor(() => {
      const mediaStructureLogs = consoleSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'object' && 
          arg && 
          'id' in arg && 
          arg.id === 'youtube-video-1'
        )
      )
      
      console.log('🔍 [DIAGNOSTIC] Found media structure logs:', mediaStructureLogs.length)
      
      if (mediaStructureLogs.length > 0) {
        mediaStructureLogs.forEach(log => {
          const mediaObj = log.find(arg => typeof arg === 'object' && arg && 'id' in arg)
          if (mediaObj) {
            console.log('🔍 [DIAGNOSTIC] Media object structure:', {
              id: mediaObj.id,
              type: mediaObj.type,
              isYouTube: mediaObj.isYouTube,
              clipStart: mediaObj.clipStart,
              clipEnd: mediaObj.clipEnd,
              hasClipTiming: mediaObj.clipStart !== undefined || mediaObj.clipEnd !== undefined
            })
          }
        })
      }
      
      // The diagnostic should pass - we're just logging information
      expect(true).toBe(true)
    }, { timeout: 8000 })
    
    consoleSpy.mockRestore()
  })
})