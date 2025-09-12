/**
 * MediaEnhancementWizard Media Selection Behavior Tests
 * 
 * Tests for the issue where the Current Media Section shows image-0 instead of video-1
 * after project reload. This reproduces the exact user scenario:
 * 1. User has a page with multiple media items (image-0 and video-1 with clip timing)
 * 2. User views the page and sees video-1 in the preview section
 * 3. But the Current Media Section shows image-0 instead of video-1
 * 4. EnhancedClipTimingDisplay never gets called because video-1 is not being rendered
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { CourseContent } from '../types/aiPrompt'

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock dependencies
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn()
}))

vi.mock('../services/mediaUrl', () => ({
  buildYouTubeEmbed: vi.fn(),
  parseYouTubeClipTiming: vi.fn()
}))

describe('MediaEnhancementWizard Media Selection Bug', () => {
  let mockInvoke: any

  const mockCourseContent: CourseContent = {
    title: 'Test Course',
    difficulty: 1,
    template: 'default',
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      media: []
    },
    learningObjectivesPage: {
      id: 'learning-objectives',
      title: 'Learning Objectives',
      content: 'Learning objectives content',
      media: [
        {
          id: 'image-0',
          type: 'image',
          title: 'Test Image',
          storageId: 'image-0-storage',
          url: 'blob://local-image-url'
        },
        {
          id: 'video-1',
          type: 'video',
          title: 'YouTube Video with Clip Timing',
          storageId: 'video-1-storage',
          isYouTube: true,
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=60',
          clipStart: 30,
          clipEnd: 60
        }
      ]
    },
    topics: []
  }

  const defaultProps = {
    courseContent: mockCourseContent,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onUpdateContent: vi.fn(),
    onSave: vi.fn()
  }

  beforeEach(async () => {
    // Get the mocked invoke function
    const { invoke } = await import('@tauri-apps/api/core')
    mockInvoke = invoke as any
    vi.clearAllMocks()

    // Mock successful media operations
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === 'get_media') {
        const { mediaId } = args || {}
        
        if (mediaId === 'image-0-storage') {
          return Promise.resolve({
            id: 'image-0-storage',
            metadata: {
              type: 'image',
              title: 'Test Image'
            },
            data: new ArrayBuffer(8) // Fake image data
          })
        }
        
        if (mediaId === 'video-1-storage') {
          return Promise.resolve({
            id: 'video-1-storage',
            metadata: {
              type: 'video',
              source: 'youtube',
              isYouTube: true,
              youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=60',
              title: 'YouTube Video with Clip Timing',
              clipStart: 30,
              clipEnd: 60
            },
            data: new ArrayBuffer(8) // Fake video data
          })
        }
      }
      
      return Promise.resolve()
    })
  })

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <NotificationProvider>
        <UnsavedChangesProvider>
          <PersistentStorageProvider>
            <UnifiedMediaProvider>
              {ui}
            </UnifiedMediaProvider>
          </PersistentStorageProvider>
        </UnsavedChangesProvider>
      </NotificationProvider>
    )
  }

  test('FAILING TEST: Should display both image-0 and video-1 in Current Media Section', async () => {
    console.log('🧪 [TEST] Starting media selection bug reproduction test...')
    
    renderWithProviders(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait for the component to load existing media
    await waitFor(() => {
      expect(screen.getByText('Current Media')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    console.log('🔍 [TEST] Component loaded, checking for media items...')
    
    // Wait for media items to be loaded and displayed
    await waitFor(async () => {
      // Should find both media items in the Current Media section
      const imageItems = screen.queryAllByText('Test Image')
      const videoItems = screen.queryAllByText('YouTube Video with Clip Timing')
      
      console.log('🎯 [TEST] Current media items found:', {
        imageItems: imageItems.length,
        videoItems: videoItems.length,
        totalItems: imageItems.length + videoItems.length
      })
      
      // 🔧 THE BUG: This assertion will FAIL if only image-0 is shown
      expect(imageItems.length).toBeGreaterThan(0)
      expect(videoItems.length).toBeGreaterThan(0) // ❌ Will fail if video-1 is missing
      
      // Should have exactly 2 media items in total
      expect(imageItems.length + videoItems.length).toBe(2)
    }, { timeout: 10000 })
    
    console.log('✅ [TEST] Both media items are displayed in Current Media Section')
  })

  test('FAILING TEST: Should call EnhancedClipTimingDisplay for video-1', async () => {
    console.log('🧪 [TEST] Testing EnhancedClipTimingDisplay rendering...')
    
    // Spy on console.log to capture the debug output
    const consoleSpy = vi.spyOn(console, 'log')
    
    renderWithProviders(<MediaEnhancementWizard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Current Media')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Wait for media items to load and debug logs to appear
    await waitFor(() => {
      // Look for the specific debug log from the Current Media Section check
      const relevantLogs = consoleSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          arg.includes('🎯 [Current Media Section] Checking Enhanced Clip Timing Display:')
        )
      )
      
      console.log('🔍 [TEST] Found Current Media Section debug logs:', relevantLogs.length)
      
      // Should have debug logs for both image-0 and video-1
      const imageLogs = consoleSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'object' && 
          arg?.mediaId === 'image-0'
        )
      )
      
      const videoLogs = consoleSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'object' && 
          arg?.mediaId === 'video-1'
        )
      )
      
      console.log('🎯 [TEST] Debug log breakdown:', {
        total: relevantLogs.length,
        imageLogs: imageLogs.length,
        videoLogs: videoLogs.length
      })
      
      // 🔧 THE BUG: This will FAIL if only image-0 debug logs appear
      expect(imageLogs.length).toBeGreaterThan(0) // Should have image-0 logs
      expect(videoLogs.length).toBeGreaterThan(0) // ❌ Will fail if video-1 logs missing
    }, { timeout: 10000 })
    
    consoleSpy.mockRestore()
    console.log('✅ [TEST] EnhancedClipTimingDisplay called for both media items')
  })

  test('DIAGNOSTIC: Show what media items are actually loaded', async () => {
    console.log('🧪 [TEST] Diagnostic test to show actual loaded media...')
    
    const consoleSpy = vi.spyOn(console, 'log')
    
    renderWithProviders(<MediaEnhancementWizard {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Current Media')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Wait a bit longer for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Look for the specific log that shows existing media items being rendered
    const renderingLogs = consoleSpy.mock.calls.filter(call => 
      call.some(arg => 
        typeof arg === 'string' && 
        arg.includes('[MediaEnhancement] 🎨 Rendering existing media items:')
      )
    )
    
    console.log('🔍 [DIAGNOSTIC] Media rendering logs found:', renderingLogs.length)
    
    if (renderingLogs.length > 0) {
      const latestLog = renderingLogs[renderingLogs.length - 1]
      console.log('📊 [DIAGNOSTIC] Latest media rendering log:', latestLog)
    }
    
    // Look for logs showing existingPageMedia state updates
    const stateUpdateLogs = consoleSpy.mock.calls.filter(call => 
      call.some(arg => 
        typeof arg === 'string' && 
        arg.includes('🎯 Setting existingPageMedia state with loaded items:')
      )
    )
    
    console.log('🔍 [DIAGNOSTIC] State update logs found:', stateUpdateLogs.length)
    
    if (stateUpdateLogs.length > 0) {
      const latestStateLog = stateUpdateLogs[stateUpdateLogs.length - 1]
      console.log('📊 [DIAGNOSTIC] Latest state update log:', latestStateLog)
    }
    
    consoleSpy.mockRestore()
    
    // This test always passes - it's just for diagnostic purposes
    expect(true).toBe(true)
  })
})