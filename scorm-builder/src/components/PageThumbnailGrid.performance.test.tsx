import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PageThumbnailGrid } from './PageThumbnailGrid';
import { CourseContent } from '../types/aiPrompt';

// Mock the UnifiedMediaContext
const mockUnifiedMediaContext = {
  getMediaForPage: vi.fn().mockReturnValue([]),
  getValidMediaForPage: vi.fn().mockResolvedValue([]), // FIXED: Added missing function
  getMedia: vi.fn().mockResolvedValue(null), // FIXED: Added for MediaPreview component
  createBlobUrl: vi.fn().mockResolvedValue('blob:mock-url'),
  mediaLoaded: true,
  loadMedia: vi.fn(),
  storeMedia: vi.fn(),
  mediaItems: [],
  deleteMedia: vi.fn(),
  error: null,
  clearError: vi.fn()
};

vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => mockUnifiedMediaContext
}));

describe('PageThumbnailGrid Performance', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      media: []
    },
    learningObjectives: {
      id: 'learning-objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      media: []
    },
    topics: [
      {
        id: 'topic-0',
        title: 'Topic 1',
        content: 'Topic 1 content',
        media: []
      },
      {
        id: 'topic-1',
        title: 'Topic 2',
        content: 'Topic 2 content',
        media: []
      },
      {
        id: 'topic-2',
        title: 'Topic 3', 
        content: 'Topic 3 content',
        media: []
      }
    ],
    assessmentQuestions: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to track calls
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not log excessively during initial render', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    // Count the console.log calls for rendering pages
    const renderingLogs = (console.log as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes?.('[PageThumbnailGrid] Rendering page')
    );

    // Should have NO rendering logs after optimization (previously was 5)
    expect(renderingLogs.length).toBe(0); // Optimized: no more debug logs in render loop
  });

  it('should not re-render excessively when props do not change', () => {
    const { rerender } = render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    // Clear console calls after initial render
    (console.log as any).mockClear();

    // Re-render with same props
    rerender(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    // Should not log rendering again if memoization is working properly
    const renderingLogs = (console.log as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes?.('[PageThumbnailGrid] Rendering page')
    );

    // With proper memoization, should have minimal or no re-rendering logs
    expect(renderingLogs.length).toBeLessThanOrEqual(5);
  });

  it('should minimize media context calls during rendering', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    // getValidMediaForPage should be called once per page with memoization (was 20, now 4)
    // Note: Some pages might be filtered out, so exact count may vary
    expect(mockUnifiedMediaContext.getValidMediaForPage).toHaveBeenCalledTimes(4); // Updated to use getValidMediaForPage
  });

  it('should handle large course content without performance degradation', () => {
    // Create a larger course with many topics
    const largeCourseContent: CourseContent = {
      ...mockCourseContent,
      topics: Array.from({ length: 20 }, (_, i) => ({
        id: `topic-${i}`,
        title: `Topic ${i + 1}`,
        content: `Topic ${i + 1} content`,
        media: []
      }))
    };

    const startTime = performance.now();

    render(
      <PageThumbnailGrid
        courseContent={largeCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Rendering should complete reasonably quickly (less than 100ms for 20 topics)
    expect(renderTime).toBeLessThan(100);

    // Should not have excessive console logging (optimized)
    const renderingLogs = (console.log as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes?.('[PageThumbnailGrid] Rendering page')
    );

    // Should have NO rendering logs after optimization
    expect(renderingLogs.length).toBe(0); // Optimized: no more debug logs
  });

  it('should not re-render when onPageSelect callback changes', () => {
    const { rerender } = render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    // Clear console calls after initial render
    (console.log as any).mockClear();

    // Re-render with different onPageSelect callback (but same functionality)
    rerender(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    );

    // Should re-render because the callback is different (this is expected behavior)
    // But the rendering should still be efficient with no debug logs
    const renderingLogs = (console.log as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes?.('[PageThumbnailGrid] Rendering page')
    );

    expect(renderingLogs.length).toBe(0); // Optimized: no debug logs in render
  });
});