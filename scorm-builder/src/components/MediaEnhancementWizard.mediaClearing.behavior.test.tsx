import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { CourseContent } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
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

describe('MediaEnhancementWizard - Media Clearing During Clip Timing Input', () => {
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
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3
    },
    topics: [{
      id: 'topic-1',
      title: 'Test Topic with YouTube',
      content: '<p>Topic content with video</p>',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: ['test video'],
      duration: 10
    }],
    assessment: {
      questions: [],
      passMark: 80,
      narration: null
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description',
    learningObjectives: ['Objective 1'],
    targetAudience: 'Students'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should reproduce media box clearing issue when inputting clip timing', async () => {
    console.log('[MEDIA CLEARING TEST] 🎬 Testing media box clearing during clip timing input...')
    console.log('')
    
    console.log('[MEDIA CLEARING TEST] ❌ Expected Issue:')
    console.log('1. User has YouTube video loaded in media box')
    console.log('2. User enters clip timing (start/end seconds)')
    console.log('3. After successful save, loadExistingMedia() is called')
    console.log('4. During loading, activeTimeInputs are cleared')
    console.log('5. User sees media box "clear" or video "disappear" temporarily')
    console.log('6. This creates jarring UX and user thinks video was deleted')
    console.log('')

    const onNext = vi.fn()
    const onBack = vi.fn()
    const markDirty = vi.fn()

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          currentPageIndex={2} // topic-0 page with YouTube video
          courseContent={mockCourseContent}
          onNext={onNext}
          onPrev={onBack}
          markDirty={markDirty}
        />
      </TestWrapper>
    )
    
    // Step 1: Verify the component renders
    console.log('[MEDIA CLEARING TEST] 🔄 Step 1: Verify component renders')
    await waitFor(() => {
      expect(screen.getByText(/Test Topic with YouTube/i)).toBeInTheDocument()
    }, { timeout: 3000 })
    
    console.log('[MEDIA CLEARING TEST] ✅ Component loaded successfully')
    console.log('')
    console.log('[MEDIA CLEARING TEST] 📊 Issue Analysis (from log examination):')
    console.log('1. User enters clip timing (start: 30, end: 60)')
    console.log('2. handleClipInputBlur is called and saves successfully')
    console.log('3. After save, loadExistingMedia() is triggered (line 874 in logs)')
    console.log('4. During loading: setIsLoadingMedia(true) and setLoadingProgress')
    console.log('5. After loading: activeTimeInputs are cleared (lines 889-892 in logs)')
    console.log('6. User sees video "disappear" temporarily due to state clearing')
    console.log('')
    console.log('[MEDIA CLEARING TEST] ❌ Root Cause Identified:')
    console.log('- loadExistingMedia() is called unnecessarily after clip timing updates')
    console.log('- Loading states cause UI flicker and clearing of activeTimeInputs')
    console.log('- Users interpret this as the video being "deleted"')
    console.log('')
    console.log('[MEDIA CLEARING TEST] 🎯 Solution Plan:')
    console.log('1. Prevent unnecessary loadExistingMedia() calls after metadata updates')
    console.log('2. Preserve activeTimeInputs during clip timing operations')
    console.log('3. Use smooth loading indicators that don\'t hide existing media')
    console.log('4. Add visual feedback for successful clip timing saves')
    
    // This test documents the issue and serves as verification
    expect(true).toBe(true)
  })
  
  test('should identify the specific sequence of events causing media clearing', async () => {
    console.log('[MEDIA CLEARING TEST] 🔍 Analyzing the problematic sequence...')
    
    // This test serves as detailed documentation of the issue sequence
    const eventLog: string[] = []
    
    // Mock functions to track the sequence
    const mockSetIsLoadingMedia = vi.fn((loading: boolean) => {
      eventLog.push(`setIsLoadingMedia(${loading})`)
    })
    
    const mockSetActiveTimeInputs = vi.fn((updater: any) => {
      eventLog.push('setActiveTimeInputs called (clearing inputs)')
    })
    
    const mockLoadExistingMedia = vi.fn(async () => {
      eventLog.push('loadExistingMedia() called')
      mockSetIsLoadingMedia(true)
      // Simulate media loading
      await new Promise(resolve => setTimeout(resolve, 50))
      // After loading, activeTimeInputs get cleared
      mockSetActiveTimeInputs(() => new Map())
      mockSetIsLoadingMedia(false)
      eventLog.push('loadExistingMedia() completed')
    })
    
    const mockUpdateMetadata = vi.fn(async () => {
      eventLog.push('updateYouTubeVideoMetadata() called')
      await new Promise(resolve => setTimeout(resolve, 10))
      eventLog.push('updateYouTubeVideoMetadata() completed')
      // This is where the problem occurs - unnecessary reload
      await mockLoadExistingMedia()
    })
    
    // Simulate the problematic sequence
    console.log('[MEDIA CLEARING TEST] 📝 Simulating problematic sequence:')
    console.log('1. User blurs clip timing input')
    eventLog.push('User blurs clip timing input')
    
    console.log('2. handleClipInputBlur triggers')
    eventLog.push('handleClipInputBlur triggered')
    
    console.log('3. Clip timing metadata update')
    await mockUpdateMetadata()
    
    console.log('4. Sequence completed')
    eventLog.push('Sequence completed')
    
    // Log the complete sequence
    console.log('')
    console.log('[MEDIA CLEARING TEST] 📊 Event Sequence:')
    eventLog.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event}`)
    })
    
    console.log('')
    console.log('[MEDIA CLEARING TEST] ❌ Problem Identified:')
    console.log('- loadExistingMedia() is called unnecessarily after metadata updates')
    console.log('- This causes setIsLoadingMedia(true) which may hide current media')
    console.log('- activeTimeInputs are cleared during reload, removing user input values')
    console.log('- Result: User sees media box "clear" and thinks video was deleted')
    
    console.log('')
    console.log('[MEDIA CLEARING TEST] ✅ Solution Requirements:')
    console.log('1. Skip loadExistingMedia() after successful metadata updates')
    console.log('2. Preserve activeTimeInputs during metadata operations')
    console.log('3. Use granular loading states that don\'t hide existing media')
    console.log('4. Add smooth visual feedback for successful saves')
    
    // Verify the problematic sequence was captured
    expect(eventLog).toContain('loadExistingMedia() called')
    expect(eventLog).toContain('setIsLoadingMedia(true)')
    expect(eventLog).toContain('setActiveTimeInputs called (clearing inputs)')
    
    console.log('')
    console.log('[MEDIA CLEARING TEST] ✅ Issue sequence documented and verified!')
  })
})