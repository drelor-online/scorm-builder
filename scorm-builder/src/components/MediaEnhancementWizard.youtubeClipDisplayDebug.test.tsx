import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'

/**
 * DEBUG TEST: YouTube Clip Timing Display Issue
 * 
 * This test reproduces the issue where YouTube clip timing is recorded
 * but not displayed correctly on the page.
 */

// Mock the UnifiedMediaContext to return YouTube video with clip timing
const mockYouTubeMediaWithClipTiming = [
  {
    id: 'youtube-video-1',
    type: 'video' as const,
    title: 'Test YouTube Video with Clip Timing',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    isYouTube: true,
    storageId: 'youtube-storage-1',
    mimeType: 'video/mp4',
    clipStart: 30,  // Should start at 30 seconds
    clipEnd: 60     // Should end at 60 seconds
  }
]

const mockUnifiedMediaContext = {
  storeMedia: vi.fn(),
  getValidMediaForPage: vi.fn().mockResolvedValue(mockYouTubeMediaWithClipTiming),
  createBlobUrl: vi.fn().mockResolvedValue('blob://mock-url'),
  cleanContaminatedMedia: vi.fn().mockResolvedValue({ cleaned: [], errors: [] })
}

// Mock other required contexts
vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => mockUnifiedMediaContext
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markDirty: vi.fn(),
    resetDirty: vi.fn()
  })
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({})
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStep: 0,
    setCurrentStep: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn()
  })
}))

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: '',
    media: mockYouTubeMediaWithClipTiming
  },
  topics: []
}

const defaultProps = {
  courseContent: mockCourseContent,
  onUpdateContent: vi.fn(),
  onNext: vi.fn(),
  onBack: vi.fn(),
  onSave: vi.fn(),
  onOpen: vi.fn(),
  onStepClick: vi.fn(),
  currentPageIndex: 0
}

describe('YouTube Clip Timing Display Debug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log('[TEST] 🏁 Test setup - mocked media:', mockYouTubeMediaWithClipTiming)
  })

  test('DEBUG: Check if media is loaded at all', async () => {
    console.log('[TEST] 🔍 Step 1: Check if component renders and loads media')
    console.log('[TEST] SIMPLEST CHECK: Does our mock function get called at all?')
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait for media to load with waitFor
    await waitFor(() => {
      const videoTitle = screen.queryByText('Test YouTube Video with Clip Timing')
      console.log('[TEST] Video title found in waitFor:', !!videoTitle)
      expect(videoTitle).toBeInTheDocument()
    }, { timeout: 10000 })
    
    console.log('[TEST] ✅ SUCCESS: YouTube video loaded and title is visible!')
    console.log('[TEST] getValidMediaForPage calls:', mockUnifiedMediaContext.getValidMediaForPage.mock.calls.length)
    console.log('[TEST] createBlobUrl calls:', mockUnifiedMediaContext.createBlobUrl.mock.calls.length)
  })

  test('DEBUG: Should display YouTube video with clip timing and log the data flow', async () => {
    console.log('[TEST] 🔍 Starting YouTube clip timing display debug test')
    console.log('[TEST] Expected: Video should load with clipStart=30, clipEnd=60')
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait longer and check if media loads
    await waitFor(() => {
      // Look for any text containing our video title or any media-related text
      const currentMediaText = screen.queryByText('Current Media')
      console.log('[TEST] Current Media section found:', !!currentMediaText)
      
      // Check all text content to see what's actually rendered
      const allText = document.body.textContent
      console.log('[TEST] Page contains "YouTube":', allText?.includes('YouTube'))
      console.log('[TEST] Page contains "Test YouTube Video":', allText?.includes('Test YouTube Video'))
      console.log('[TEST] Page contains "Current Media":', allText?.includes('Current Media'))
      console.log('[TEST] getValidMediaForPage calls:', mockUnifiedMediaContext.getValidMediaForPage.mock.calls.length)
      
      expect(currentMediaText).toBeTruthy()
    }, { timeout: 5000 })
  })
  
  test('DEBUG: Check if iframe src contains clip timing parameters', async () => {
    console.log('[TEST] 🔍 Checking if generated iframe contains clip timing parameters')
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait for media to load
    await waitFor(() => {
      const mediaTitle = screen.queryByText('Test YouTube Video with Clip Timing')
      expect(mediaTitle).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Look for any iframe elements (the video preview should be rendered somewhere)
    const iframes = document.querySelectorAll('iframe')
    console.log(`[TEST] 📺 Found ${iframes.length} iframe(s) on the page`)
    
    iframes.forEach((iframe, index) => {
      const src = iframe.getAttribute('src')
      console.log(`[TEST] 📺 Iframe ${index + 1} src:`, src)
      console.log(`[TEST] 📺 Contains start parameter:`, src?.includes('start='))
      console.log(`[TEST] 📺 Contains end parameter:`, src?.includes('end='))
      
      if (src?.includes('youtube.com/embed')) {
        console.log('[TEST] 📺 This is a YouTube embed iframe')
        if (src.includes('start=30') && src.includes('end=60')) {
          console.log('[TEST] ✅ SUCCESS: Iframe contains correct clip timing parameters!')
        } else {
          console.log('[TEST] ❌ ISSUE: Iframe missing expected clip timing parameters')
          console.log('[TEST] Expected: start=30 and end=60')
          console.log('[TEST] Actual src:', src)
        }
      }
    })
    
    // This test will help us see if the iframe is being generated correctly
    expect(iframes.length).toBeGreaterThan(0)
  })
})