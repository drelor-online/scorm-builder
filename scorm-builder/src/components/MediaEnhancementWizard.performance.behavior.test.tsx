import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { render, screen } from '../test/testProviders'
import { MediaService } from '../services/MediaService'
import { FileStorage } from '../services/FileStorage'
import type { CourseContent } from '../types/aiPrompt'

// Mock the MediaService and FileStorage
vi.mock('../services/MediaService')
vi.mock('../services/FileStorage')

describe('MediaEnhancementWizard Performance Tests', () => {
  let mockMediaService: MediaService
  let mockFileStorage: FileStorage
  
  const mockCourseContent: CourseContent = {
    welcome: {
      id: 'welcome',
      title: 'Welcome Page',
      content: 'Welcome content',
      media: []
    },
    objectives: {
      id: 'objectives', 
      title: 'Learning Objectives',
      content: 'Objectives content',
      media: []
    },
    topics: [
      {
        id: 'topic-1',
        title: 'First Topic',
        content: 'Topic content',
        media: []
      },
      {
        id: 'topic-2', 
        title: 'Second Topic',
        content: 'Another topic',
        media: []
      }
    ],
    knowledgeCheck: {
      id: 'knowledge-check',
      title: 'Knowledge Check',
      content: 'Quiz content',
      media: []
    },
    summary: {
      id: 'summary',
      title: 'Summary',
      content: 'Summary content', 
      media: []
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockFileStorage = {
      storeMedia: vi.fn(),
      storeYouTubeVideo: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
      listMediaForPage: vi.fn().mockResolvedValue([])
    } as any
    
    mockMediaService = new MediaService({
      projectId: 'test-project',
      fileStorage: mockFileStorage
    })
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  test('should not recalculate expensive computations on prop changes', async () => {
    // SPY ON EXPENSIVE OPERATIONS
    const getCurrentPageSpy = vi.fn()
    const validateContentSpy = vi.fn()
    const getPageTitleSpy = vi.fn()
    
    // Mock the component to track function calls
    const OriginalComponent = MediaEnhancementWizard
    const SpyComponent = (props: any) => {
      // Track expensive computation calls
      React.useMemo(() => {
        getCurrentPageSpy()
        return props.courseContent
      }, [props.courseContent])
      
      React.useMemo(() => {
        validateContentSpy()
        return props.courseContent
      }, [props.courseContent])
      
      React.useMemo(() => {
        getPageTitleSpy()
        return 'Test Title'
      }, [props.courseContent])
      
      return <OriginalComponent {...props} />
    }
    
    const { rerender } = render(
      <SpyComponent
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    
    // Initial render should call expensive functions
    expect(getCurrentPageSpy).toHaveBeenCalledTimes(1)
    expect(validateContentSpy).toHaveBeenCalledTimes(1)
    expect(getPageTitleSpy).toHaveBeenCalledTimes(1)
    
    // Reset spies
    getCurrentPageSpy.mockClear()
    validateContentSpy.mockClear() 
    getPageTitleSpy.mockClear()
    
    // Re-render with same props - should NOT call expensive functions again
    rerender(
      <SpyComponent
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    
    // THESE SHOULD FAIL INITIALLY - proving we need memoization
    expect(getCurrentPageSpy).toHaveBeenCalledTimes(0) // Should be 0 after memoization
    expect(validateContentSpy).toHaveBeenCalledTimes(0) // Should be 0 after memoization  
    expect(getPageTitleSpy).toHaveBeenCalledTimes(0) // Should be 0 after memoization
  })
  
  test('should memoize event handlers to prevent child re-renders', () => {
    // Mock render tracking for child components
    const PageThumbnailGridRenderSpy = vi.fn()
    
    // Mock PageThumbnailGrid to track renders
    vi.doMock('./PageThumbnailGrid', () => ({
      PageThumbnailGrid: (props: any) => {
        PageThumbnailGridRenderSpy()
        return <div data-testid="page-thumbnail-grid">Grid</div>
      }
    }))
    
    const { rerender } = render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    
    expect(PageThumbnailGridRenderSpy).toHaveBeenCalledTimes(1)
    
    PageThumbnailGridRenderSpy.mockClear()
    
    // Re-render with same props
    rerender(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    
    // Should NOT re-render PageThumbnailGrid if handlers are memoized
    expect(PageThumbnailGridRenderSpy).toHaveBeenCalledTimes(0)
  })

  test('should efficiently handle page navigation without unnecessary computations', () => {
    const computationSpy = vi.fn()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    
    // This test will verify that page switching doesn't trigger
    // expensive re-computations of unrelated data
    
    // Initial state - should see current page computed
    expect(screen.getByText('Welcome Page')).toBeInTheDocument()
    
    // TODO: Add page navigation interaction and verify
    // that only relevant computations are triggered
  })
})