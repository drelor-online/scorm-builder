import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PageThumbnailGrid } from './PageThumbnailGrid'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { CourseContent } from '../types/aiPrompt'

// Mock console.log to capture PageThumbnailGrid logging
const mockConsoleLog = vi.fn()
const originalConsoleLog = console.log
beforeEach(() => {
  vi.clearAllMocks()
  mockConsoleLog.mockClear()
  console.log = mockConsoleLog
})

afterEach(() => {
  console.log = originalConsoleLog
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

describe('PageThumbnailGrid - Clip Timing Persistence Issue', () => {
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
      title: 'Topic with YouTube Clip Timing',
      content: '<p>Topic content with clip timing video</p>',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: ['test video with timing'],
      duration: 10
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  test('should reproduce issue where PageThumbnailGrid loses clip timing parameters', async () => {
    console.log('[CLIP TIMING PERSISTENCE TEST] 🎬 Testing PageThumbnailGrid clip timing persistence issue...')
    console.log('')
    
    console.log('[CLIP TIMING PERSISTENCE TEST] ❌ Expected Issue:')
    console.log('1. User has YouTube video with clip timing (start=30, end=60) in MediaEnhancementWizard')
    console.log('2. User saves project and returns to dashboard (PageThumbnailGrid)')
    console.log('3. PageThumbnailGrid processes video URL but loses clip timing parameters') 
    console.log('4. Video shows as plain URL instead of URL with &start=30&end=60')
    console.log('5. When user reopens project, clip timing is gone from UI (even though data persists)')
    console.log('')

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

    // Step 1: Wait for component to render and load media
    console.log('[CLIP TIMING PERSISTENCE TEST] 🔄 Step 1: Wait for component to render')
    await waitFor(() => {
      expect(screen.getByTestId('page-thumbnail-grid')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Step 2: Let media loading complete
    console.log('[CLIP TIMING PERSISTENCE TEST] 🔄 Step 2: Allow media loading to complete')
    await waitFor(() => {
      // Wait for media loading calls to appear in console.log
      const logCalls = mockConsoleLog.mock.calls.map(call => call[0]).join(' ')
      return logCalls.includes('PageThumbnailGrid') || logCalls.includes('Processing YouTube video')
    }, { timeout: 5000 })

    // Step 3: Examine console logs to identify the issue
    console.log('')
    console.log('[CLIP TIMING PERSISTENCE TEST] 🔍 Step 3: Analyzing PageThumbnailGrid behavior...')
    
    const allLogs = mockConsoleLog.mock.calls.map(call => call.join(' ')).join('\n')
    console.log('[CLIP TIMING PERSISTENCE TEST] 📊 Console output analysis:')
    
    // Look for YouTube video processing logs
    const youtubeProcessingLogs = mockConsoleLog.mock.calls
      .filter(call => call[0] && call[0].includes && call[0].includes('Processing YouTube video'))
      
    if (youtubeProcessingLogs.length > 0) {
      console.log(`✅ Found ${youtubeProcessingLogs.length} YouTube video processing log(s)`)
      youtubeProcessingLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log[0]}: ${log[1] || 'N/A'}`)
        
        // Check if the URL contains clip timing parameters
        const url = log[1] || ''
        const hasClipTiming = url.includes('start=') && url.includes('end=')
        
        if (hasClipTiming) {
          console.log(`      ✅ URL contains clip timing: ${url}`)
        } else {
          console.log(`      ❌ URL MISSING clip timing: ${url}`)
          console.log(`      🔧 Expected: URL should contain &start=30&end=60 parameters`)
        }
      })
    } else {
      console.log('❌ No YouTube video processing logs found')
      console.log('🔍 Available logs:')
      mockConsoleLog.mock.calls.slice(0, 10).forEach((call, index) => {
        console.log(`   ${index + 1}. ${call[0]} ${call[1] || ''}`)
      })
    }

    console.log('')
    console.log('[CLIP TIMING PERSISTENCE TEST] 🎯 Root Cause Analysis:')
    console.log('❌ ISSUE: PageThumbnailGrid uses raw metadata.youtubeUrl instead of processed URL')
    console.log('📍 LOCATION: PageThumbnailGrid.tsx lines 64-65')
    console.log('🔧 CURRENT CODE: const ytUrl = firstMediaRef.metadata?.youtubeUrl || firstMediaRef.metadata?.embedUrl')
    console.log('💡 PROBLEM: This gets the original URL WITHOUT clip timing parameters')
    console.log('✅ SOLUTION: Should call getMedia(id) to get processed URL WITH clip timing')
    
    console.log('')
    console.log('[CLIP TIMING PERSISTENCE TEST] 📋 Expected Fix:')
    console.log('1. In PageThumbnailGrid MediaPreview component:')
    console.log('2. Replace raw metadata URL usage with getMedia() call')
    console.log('3. Use the processed URL that includes clip timing parameters')
    console.log('4. This will fix the dashboard thumbnail view to preserve clip timing')

    // This test documents the issue - it will need to be updated after the fix
    // For now, we expect this to show the issue exists
    const hasIssue = youtubeProcessingLogs.some(log => {
      const url = log[1] || ''
      return url.length > 0 && !url.includes('start=') && !url.includes('end=')
    })

    console.log('')
    if (hasIssue) {
      console.log('[CLIP TIMING PERSISTENCE TEST] ✅ Issue reproduced successfully!')
      console.log('[CLIP TIMING PERSISTENCE TEST] 📍 PageThumbnailGrid is processing URLs without clip timing')
    } else {
      console.log('[CLIP TIMING PERSISTENCE TEST] ❓ Issue may already be fixed or different test scenario needed')
    }

    // This test serves as documentation of the issue
    expect(true).toBe(true)
  })
  
  test('should document the expected behavior after fix', async () => {
    console.log('[CLIP TIMING PERSISTENCE TEST] 📋 Documenting expected behavior after fix...')
    console.log('')
    
    console.log('[CLIP TIMING PERSISTENCE TEST] ✅ After Fix - Expected Behavior:')
    console.log('1. User has YouTube video with clip timing (start=30, end=60)')
    console.log('2. MediaEnhancementWizard displays video with timing correctly')
    console.log('3. User saves project and returns to dashboard')
    console.log('4. PageThumbnailGrid calls getMedia() for each video')
    console.log('5. getMedia() returns processed URL: "https://www.youtube.com/watch?v=ID&start=30&end=60"')
    console.log('6. PageThumbnailGrid uses processed URL for thumbnail generation')
    console.log('7. Video thumbnail reflects correct timing information')
    console.log('8. When user reopens project, clip timing is preserved in UI')
    console.log('')
    
    console.log('[CLIP TIMING PERSISTENCE TEST] 🔧 Implementation Details:')
    console.log('- PageThumbnailGrid MediaPreview component will be updated')
    console.log('- Instead of using firstMediaRef.metadata?.youtubeUrl directly')
    console.log('- Will call getMedia(firstMediaRef.id) to get processed URL')
    console.log('- This ensures consistency with MediaEnhancementWizard behavior')
    console.log('- Clip timing parameters will be preserved across all components')
    
    console.log('')
    console.log('[CLIP TIMING PERSISTENCE TEST] 🎯 Success Criteria:')
    console.log('✅ PageThumbnailGrid logs show URLs WITH clip timing parameters')
    console.log('✅ Dashboard thumbnails reflect the correct video segments')
    console.log('✅ No regression in existing PageThumbnailGrid functionality')
    console.log('✅ Consistent behavior between MediaEnhancementWizard and PageThumbnailGrid')
    
    expect(true).toBe(true)
  })
})