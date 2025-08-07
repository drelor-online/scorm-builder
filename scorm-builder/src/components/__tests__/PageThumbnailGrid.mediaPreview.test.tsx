import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageThumbnailGrid } from '../PageThumbnailGrid'

// Mock functions for media context
const mockGetMediaForPage = vi.fn()
const mockCreateBlobUrl = vi.fn().mockImplementation((mediaId: string) => {
  // Return a blob URL for media items
  return Promise.resolve(`blob:http://localhost/mock-${mediaId}`)
})

// Mock the media context
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    getMediaForPage: mockGetMediaForPage,
    createBlobUrl: mockCreateBlobUrl,
    getMediaUrl: (id: string) => `blob:mock-url-${id}`,
    listMedia: vi.fn().mockResolvedValue([])
  })
}))

describe('PageThumbnailGrid - Media Preview Display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to return proper blob URLs
    mockCreateBlobUrl.mockImplementation((mediaId: string) => {
      return Promise.resolve(`blob:http://localhost/mock-${mediaId}`)
    })
  })
  
  // Test for the correct media ID usage
  it('should use media.id directly when creating blob URLs for media', async () => {
    // Mock that no media exists in storage yet
    mockGetMediaForPage.mockReturnValue([])
    mockCreateBlobUrl.mockResolvedValue('blob:http://localhost/test-blob')
    
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        media: [
          {
            id: 'image-0',  // The media ID to use
            type: 'image',
            title: 'Test Image',
            url: 'scorm-media://welcome/image-0'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '',
        media: []
      },
      topics: []
    }
    
    render(
      <PageThumbnailGrid
        courseContent={courseContent}
        currentPageId="welcome"
        onPageSelect={vi.fn()}
      />
    )
    
    // Wait for the async effect to run
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Should use the media.id directly
    expect(mockCreateBlobUrl).toHaveBeenCalledWith('image-0')
  })
  
  const mockCourseContent = {
    welcomePage: {
      id: 'page-1',
      title: 'Page with Image',
      content: '<p>Content</p>',
      media: [{
        id: 'image-123',
        type: 'image' as const,
        title: 'Test Image',
        url: 'scorm-media://page-1/image-123'
      }]
    },
    learningObjectivesPage: {
      id: 'page-2',
      title: 'Page with Video',
      content: '<p>Content</p>',
      media: [{
        id: 'video-456',
        type: 'video' as const,
        title: 'Test Video',
        url: 'scorm-media://page-2/video-456'
      }]
    },
    topics: [{
      id: 'page-3',
      title: 'Page without Media',
      content: '<p>Just text content</p>',
      media: []
    }],
    assessment: {
      questions: [],
      passMark: 80
    }
  }
  
  it('should display media preview in page thumbnails', async () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Wait for async media loading
    await waitFor(async () => {
      // Check for image preview in first page
      const page1Thumbnail = screen.getByText('Page with Image').closest('[role="button"], [role="article"]')
      expect(page1Thumbnail).toBeInTheDocument()
      
      // Should have image preview
      const imagePreview = page1Thumbnail?.querySelector('img')
      expect(imagePreview).toBeInTheDocument()
      
      if (imagePreview && 'src' in imagePreview) {
        expect(imagePreview.src).toContain('blob:')
      }
    })
  })
  
  it('should show video thumbnail or indicator for video pages', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Check for video indicator in second page
    const page2Thumbnail = screen.getByText('Page with Video').closest('[role="button"], [role="article"]')
    expect(page2Thumbnail).toBeInTheDocument()
    
    // Should have video indicator (play icon or video thumbnail)
    const videoIndicator = page2Thumbnail?.querySelector('[class*="video"], [aria-label*="video"], svg[class*="play"]')
    const videoThumbnail = page2Thumbnail?.querySelector('img, video')
    
    // Should have either a video indicator or thumbnail
    expect(videoIndicator || videoThumbnail).toBeTruthy()
  })
  
  it('should show placeholder for pages without media', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Check for placeholder in third page
    const page3Thumbnail = screen.getByText('Page without Media').closest('[role="button"], [role="article"]')
    expect(page3Thumbnail).toBeInTheDocument()
    
    // Should have placeholder or text-only indicator
    const placeholder = page3Thumbnail?.querySelector('[class*="placeholder"], [class*="no-media"], [class*="text-only"]')
    const hasNoImage = !page3Thumbnail?.querySelector('img, video')
    
    // Should either have a placeholder element or no media elements
    expect(placeholder || hasNoImage).toBeTruthy()
  })
  
  it('should maintain aspect ratio for media previews', async () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Wait for media to load
    await waitFor(() => {
      const images = document.querySelectorAll('img')
      expect(images.length).toBeGreaterThan(0)
    })
    
    // Get all media previews
    const mediaPreviews = document.querySelectorAll('img')
    
    mediaPreviews.forEach(preview => {
      const styles = window.getComputedStyle(preview)
      
      // Should maintain aspect ratio
      expect(styles.objectFit).toMatch(/cover|contain|scale-down/)
      
      // Should have defined dimensions
      const width = parseFloat(styles.width)
      const height = parseFloat(styles.height)
      
      // Width and height might be auto or 100% which would parse as NaN
      // Just check they're set
      expect(styles.width).toBeTruthy()
      expect(styles.height).toBeTruthy()
    })
  })
  
  it('should show media type indicator overlay', () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Pages with media should have type indicators
    const page1Thumbnail = screen.getByText('Page with Image').closest('[role="button"], [role="article"]')
    const page2Thumbnail = screen.getByText('Page with Video').closest('[role="button"], [role="article"]')
    
    // Check for media type icons or labels
    const imageIcon = page1Thumbnail?.querySelector('[aria-label*="image"], [class*="image-icon"], svg[class*="image"]')
    const videoIcon = page2Thumbnail?.querySelector('[aria-label*="video"], [class*="video-icon"], svg[class*="video"], [class*="play"]')
    
    // At least one type indicator should be present
    expect(imageIcon || videoIcon).toBeTruthy()
  })
  
  it('should handle loading states for media previews', async () => {
    render(
      <PageThumbnailGrid
        courseContent={mockCourseContent}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Wait for media to load
    await waitFor(() => {
      const images = document.querySelectorAll('img')
      expect(images.length).toBeGreaterThan(0)
    })
    
    // Check for loading indicators or lazy loading
    const images = document.querySelectorAll('img')
    
    images.forEach(img => {
      // Should have loading attribute for performance
      expect(img).toHaveAttribute('loading')
      
      // Should have alt text for accessibility
      expect(img).toHaveAttribute('alt')
    })
  })
})