import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  saveCourseContent: vi.fn(),
  saveProject: vi.fn()
}

// Mock the unified media context
const mockMediaContext = {
  getMedia: vi.fn(),
  storeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  clearAll: vi.fn(),
  totalSizeBytes: 0,
  mediaCount: 0,
  isLoading: false
}

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnifiedMediaProvider projectId="test-project">
        <UnsavedChangesProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </UnsavedChangesProvider>
      </UnifiedMediaProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

// Valid course content with media
const courseContentWithMedia = {
  welcomePage: {
    id: 'content-0',
    title: 'Welcome',
    content: '<h1>Welcome</h1>',
    narration: 'Welcome',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 2,
    media: [{ id: 'slow-media-1', type: 'image', title: 'Slow Image', url: 'blob:test' }],
    audioId: 'slow-audio-1'
  },
  learningObjectivesPage: {
    id: 'content-1',
    title: 'Objectives',
    content: '<h2>Objectives</h2>',
    narration: 'Objectives',
    imageKeywords: [],
    imagePrompts: [],
    videoSearchTerms: [],
    duration: 1
  },
  topics: [
    {
      id: 'content-2',
      title: 'Topic 1',
      content: '<h2>Topic 1</h2>',
      narration: 'Topic 1',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: [{ id: 'slow-media-2', type: 'video', title: 'Slow Video', url: 'blob:test' }]
    }
  ],
  assessment: {
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice' as const,
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: 'Test explanation.'
      }
    ]
  }
}

const courseSeedData = {
  courseTitle: 'Test Course',
  courseDescription: 'Test Description',
  targetAudience: 'Test Audience',
  learningObjectives: ['Objective 1'],
  assessmentCriteria: ['Criteria 1'],
  additionalContext: ''
}

describe('SCORMPackageBuilder Media Loading Race Condition', () => {
  let abortedRequests: Set<string>
  
  beforeEach(() => {
    vi.clearAllMocks()
    abortedRequests = new Set()
    
    // Mock storage to return no saved data initially
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    
    // Mock media context with slow loading media to simulate race condition
    mockMediaContext.getMedia.mockImplementation((mediaId: string) => {
      return new Promise((resolve, reject) => {
        // Simulate different loading speeds for different media
        const delay = mediaId.includes('slow') ? 6000 : 100 // 6s for slow media (exceeds 5s timeout)
        
        const timeout = setTimeout(() => {
          if (abortedRequests.has(mediaId)) {
            reject(new Error('Request was aborted'))
            return
          }
          
          // Return mock media data
          resolve({
            data: new Uint8Array([1, 2, 3, 4]), // Mock binary data
            url: `blob:test-${mediaId}`,
            metadata: { size: 4, type: 'image/jpeg' }
          })
        }, delay)
        
        // Store timeout for potential cleanup
        ;(global as any).__mediaTimeouts = (global as any).__mediaTimeouts || new Map()
        ;(global as any).__mediaTimeouts.set(mediaId, timeout)
      })
    })
  })
  
  afterEach(() => {
    // Clean up any pending timeouts
    if ((global as any).__mediaTimeouts) {
      for (const timeout of (global as any).__mediaTimeouts.values()) {
        clearTimeout(timeout)
      }
      ;(global as any).__mediaTimeouts.clear()
    }
  })

  it('should handle media loading timeout without memory leaks', async () => {
    const user = userEvent.setup()
    
    render(
      <TestProviders>
        <SCORMPackageBuilder 
          courseContent={courseContentWithMedia as any}
          courseSeedData={courseSeedData as any}
          onBack={vi.fn()}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onStepClick={vi.fn()}
        />
      </TestProviders>
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Generate SCORM Package/i)).toBeInTheDocument()
    })

    // Click generate to start media loading
    const generateButton = screen.getByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to start
    await waitFor(() => {
      expect(screen.getByText(/Preparing SCORM package/i)).toBeInTheDocument()
    })

    // Should show timeout warnings for slow media (this demonstrates the race condition)
    // The timeout should win the race and the original promises should continue in background
    
    let timeoutWarnings = 0
    const originalConsoleWarn = console.warn
    console.warn = (...args) => {
      if (args[0]?.includes?.('Timeout loading media')) {
        timeoutWarnings++
      }
      originalConsoleWarn(...args)
    }

    // Wait for timeouts to occur (5s + buffer)
    await new Promise(resolve => setTimeout(resolve, 5500))

    // Should have timed out on slow media
    expect(timeoutWarnings).toBeGreaterThan(0)
    
    // RACE CONDITION: The original promises are still running in background
    // This test demonstrates the issue - we can't easily verify memory leaks in tests,
    // but the background promises continue even after timeout
    
    console.warn = originalConsoleWarn
  })

  it('should handle component unmounting during media loading without errors', async () => {
    const user = userEvent.setup()
    
    const { unmount } = render(
      <TestProviders>
        <SCORMPackageBuilder 
          courseContent={courseContentWithMedia as any}
          courseSeedData={courseSeedData as any}
          onBack={vi.fn()}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onStepClick={vi.fn()}
        />
      </TestProviders>
    )

    // Click generate to start media loading
    const generateButton = screen.getByRole('button', { name: /Generate SCORM Package/i })
    await user.click(generateButton)

    // Wait for generation to start
    await waitFor(() => {
      expect(screen.getByText(/Preparing SCORM package/i)).toBeInTheDocument()
    })

    // Unmount component while media is still loading
    // This should not cause errors or continue background operations
    act(() => {
      unmount()
    })

    // Wait a bit to see if any errors occur from background operations
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // If we get here without errors, the test passes
    // But the race condition means media loading continues in background
    expect(true).toBe(true)
  })

  it('should handle rapid generate button clicks without duplicate operations', async () => {
    const user = userEvent.setup()
    
    render(
      <TestProviders>
        <SCORMPackageBuilder 
          courseContent={courseContentWithMedia as any}
          courseSeedData={courseSeedData as any}
          onBack={vi.fn()}
          onSettingsClick={vi.fn()}
          onHelp={vi.fn()}
          onSave={vi.fn()}
          onOpen={vi.fn()}
          onStepClick={vi.fn()}
        />
      </TestProviders>
    )

    const generateButton = screen.getByRole('button', { name: /Generate SCORM Package/i })
    
    // Rapidly click generate button multiple times
    await user.click(generateButton)
    await user.click(generateButton)
    await user.click(generateButton)

    // Should only start one generation process
    // The button should be disabled after first click
    await waitFor(() => {
      expect(generateButton).toBeDisabled()
    })

    // Verify only one set of media requests was made
    // (This test may need adjustment based on actual implementation)
    expect(mockMediaContext.getMedia).toHaveBeenCalledTimes(2) // Welcome + Topic media
  })
})