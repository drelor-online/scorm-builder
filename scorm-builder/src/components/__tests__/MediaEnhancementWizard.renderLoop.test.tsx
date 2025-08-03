import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

// Track render counts
let renderCount = 0

// Mock the media context
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUnifiedMedia: () => {
    // Track how many times this hook is called
    renderCount++
    return {
      listMedia: vi.fn().mockResolvedValue([]),
      getMediaForPage: vi.fn().mockReturnValue([]),
      storeMedia: vi.fn(),
      deleteMedia: vi.fn(),
      createBlobUrl: vi.fn(),
      revokeBlobUrl: vi.fn(),
      getMediaUrl: vi.fn(),
      storeExternalMedia: vi.fn(),
      storeYouTubeVideo: vi.fn()
    }
  }
}))

const mockCourseContent = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    media: []
  },
  learningObjectivesPage: {
    id: 'objectives', 
    title: 'Objectives',
    content: 'Objectives content',
    media: []
  },
  topics: []
}

describe('MediaEnhancementWizard - Render Loop Prevention', () => {
  const mockOnComplete = vi.fn()
  const mockOnPageChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    renderCount = 0
  })

  it('should not cause infinite render loops on mount', async () => {
    render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Wait for component to stabilize
    await waitFor(() => {
      expect(screen.getByText(/Media Enhancement/i)).toBeInTheDocument()
    }, { timeout: 1000 })

    // Component should not render more than a reasonable number of times
    // (initial render + a few re-renders for state updates)
    expect(renderCount).toBeLessThan(10)
    
    // Verify no error about maximum update depth
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded')
    )
  })

  it('should not cause infinite loops when switching tabs', async () => {
    render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    const initialRenderCount = renderCount

    // Switch to upload tab
    const uploadTab = screen.getByText(/Upload/i)
    fireEvent.click(uploadTab)

    await waitFor(() => {
      expect(screen.getByText(/Drop files here/i)).toBeInTheDocument()
    })

    const afterUploadCount = renderCount

    // Switch to AI tools tab
    const aiTab = screen.getByText(/AI Image Tools/i)
    fireEvent.click(aiTab)

    await waitFor(() => {
      expect(screen.getByText(/AI Image Generation Helper/i)).toBeInTheDocument()
    })

    const afterAICount = renderCount

    // Each tab switch should only cause a few re-renders, not infinite
    expect(afterUploadCount - initialRenderCount).toBeLessThan(5)
    expect(afterAICount - afterUploadCount).toBeLessThan(5)
  })

  it('should properly memoize getCurrentPage function', async () => {
    const getMediaForPageSpy = vi.fn().mockReturnValue([])
    
    vi.mock('../../contexts/UnifiedMediaContext', () => ({
      useUnifiedMedia: () => ({
        getMediaForPage: getMediaForPageSpy,
        // ... other methods
      })
    }))

    const { rerender } = render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    const initialCallCount = getMediaForPageSpy.mock.calls.length

    // Re-render with same props
    rerender(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Should not trigger additional calls if props haven't changed
    expect(getMediaForPageSpy.mock.calls.length).toBe(initialCallCount)
  })

  it('should only load media when page changes', async () => {
    const getMediaForPageSpy = vi.fn().mockReturnValue([])

    const { rerender } = render(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={0}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    const initialCallCount = renderCount

    // Change to different page
    rerender(
      <UnifiedMediaProvider>
        <StepNavigationProvider>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            onComplete={mockOnComplete}
            currentPageIndex={1}
            onPageChange={mockOnPageChange}
          />
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    )

    // Should trigger media loading for new page
    expect(renderCount - initialCallCount).toBeGreaterThan(0)
    expect(renderCount - initialCallCount).toBeLessThan(5)
  })
})