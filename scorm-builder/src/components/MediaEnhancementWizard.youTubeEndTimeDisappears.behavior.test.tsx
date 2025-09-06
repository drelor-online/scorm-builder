import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import type { CourseContent } from '../types/aiPrompt'

// Mock the search service
vi.mock('../services/searchService', () => ({
  searchGoogleImages: vi.fn().mockResolvedValue([]),
  searchYouTubeVideos: vi.fn().mockResolvedValue([]),
  SearchError: class SearchError extends Error {}
}))

// Mock the external image downloader  
vi.mock('../services/externalImageDownloader', () => ({
  isKnownCorsRestrictedDomain: vi.fn().mockReturnValue(false),
  downloadExternalImage: vi.fn().mockResolvedValue('blob:mock-url')
}))

// Mock PersistentStorageContext to avoid storage dependencies
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStorage: () => ({
    saveProject: vi.fn(),
    loadProject: vi.fn(),
    saveCourseSeedData: vi.fn(),
    loadCourseSeedData: vi.fn()
  })
}))

// Mock NotificationContext to avoid notification dependencies
vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNotifications: () => ({
    addNotification: vi.fn()
  })
}))

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <UnifiedMediaProvider>
    <PersistentStorageProvider>
      {children}
    </PersistentStorageProvider>
  </UnifiedMediaProvider>
)

describe('MediaEnhancementWizard - YouTube End Time Disappearing Issue', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome to the course',
      media: [
        {
          id: 'youtube-test-video',
          type: 'youtube' as const,
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Test YouTube Video',
          description: 'Test video for clip timing',
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
        }
      ]
    },
    learningObjectivesPage: {
      id: 'objectives', 
      title: 'Learning Objectives',
      content: 'Course objectives',
      media: []
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1 with YouTube Video',
        content: 'This topic has a YouTube video for clip testing',
        media: []
      }
    ],
    assessmentQuestions: []
  }

  const mockProps = {
    courseContent: mockCourseContent,
    currentPageIndex: 0, // Point to welcome page with YouTube video
    onNext: vi.fn(),
    onBack: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce the issue where end time disappears after blur while start time persists', async () => {
    // Render the component with a topic that has a YouTube video
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={0} // Welcome page with YouTube video
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    // Wait for the component to load and display the YouTube video
    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    // Find the start and end time input fields
    const startInput = screen.getByPlaceholderText('0:30 or 30') as HTMLInputElement
    const endInput = screen.getByPlaceholderText('2:00 or 120') as HTMLInputElement

    // Verify inputs exist and are initially empty
    expect(startInput).toBeInTheDocument()
    expect(endInput).toBeInTheDocument()
    expect(startInput.value).toBe('')
    expect(endInput.value).toBe('')

    // Step 1: Enter start time and blur - this should work
    await act(async () => {
      fireEvent.focus(startInput)
    })
    
    await act(async () => {
      fireEvent.change(startInput, { target: { value: '30' } })
    })
    
    await act(async () => {
      fireEvent.blur(startInput)
    })

    // Wait a moment for any state updates
    await waitFor(() => {
      // Start time should be formatted and persist
      expect(startInput.value).toBe('0:30')
    }, { timeout: 2000 })

    // Step 2: Enter end time and blur - this is where the issue occurs
    await act(async () => {
      fireEvent.focus(endInput)
    })
    
    await act(async () => {
      fireEvent.change(endInput, { target: { value: '120' } })
    })
    
    // Add a small delay to simulate real user interaction
    await new Promise(resolve => setTimeout(resolve, 100))
    
    await act(async () => {
      fireEvent.blur(endInput)
    })

    // This is the failing assertion - end time should persist but currently disappears
    await waitFor(() => {
      // BUG: End time disappears even though start time works
      expect(endInput.value).toBe('2:00') // This should pass but currently fails
      expect(startInput.value).toBe('0:30') // This should still work
    }, { timeout: 2000 })

    // Additional verification: Both values should be stored in the component state
    // We can't directly test internal state, but we can test that both inputs maintain their values
    // even after additional interactions
    
    // Click somewhere else to ensure focus changes don't affect the values
    const somewhereElse = screen.getByText('Test YouTube Video')
    await act(async () => {
      fireEvent.click(somewhereElse)
    })

    // Wait and verify both values are still present
    await waitFor(() => {
      expect(startInput.value).toBe('0:30')
      expect(endInput.value).toBe('2:00')
    })
  }, 10000) // Increase timeout for this complex test

  it('should show that start time alone works correctly (control test)', async () => {
    // This test should pass to confirm that start time functionality works
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    const startInput = screen.getByPlaceholderText('0:30 or 30') as HTMLInputElement

    // Enter and blur start time
    await act(async () => {
      fireEvent.focus(startInput)
      fireEvent.change(startInput, { target: { value: '45' } })
      fireEvent.blur(startInput)
    })

    // Start time should work correctly
    await waitFor(() => {
      expect(startInput.value).toBe('0:45')
    })
  })

  it('should demonstrate the race condition by testing rapid focus/blur cycles', async () => {
    // This test aims to reproduce race conditions that might cause the end time to disappear
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          currentPageIndex={0}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
    })

    const startInput = screen.getByPlaceholderText('0:30 or 30') as HTMLInputElement
    const endInput = screen.getByPlaceholderText('2:00 or 120') as HTMLInputElement

    // Rapid interaction sequence that might trigger race conditions
    await act(async () => {
      // Set start time
      fireEvent.focus(startInput)
      fireEvent.change(startInput, { target: { value: '30' } })
      fireEvent.blur(startInput)
      
      // Immediately try end time
      fireEvent.focus(endInput)
      fireEvent.change(endInput, { target: { value: '90' } })
      
      // Trigger multiple blur/focus cycles rapidly
      fireEvent.blur(endInput)
      fireEvent.focus(endInput)
      fireEvent.blur(endInput)
    })

    // Both values should survive the rapid interaction
    await waitFor(() => {
      expect(startInput.value).toBe('0:30')
      expect(endInput.value).toBe('1:30') // Should not disappear
    }, { timeout: 2000 })
  })
})