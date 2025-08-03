import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PageThumbnailGrid } from '../PageThumbnailGrid'

// Mock functions for media context
const mockGetMediaForPage = vi.fn()
const mockCreateBlobUrl = vi.fn()

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
  })
  
  // Test for the bug: using id instead of storageId
  it('should use storageId (not id) when creating blob URLs for media', async () => {
    const mediaWithStorageId = {
      id: 'media-123',
      storageId: 'storage-456',  // This is what should be used
      type: 'image',
      url: 'https://example.com/image.jpg',
      title: 'Test Image'
    }
    
    mockGetMediaForPage.mockReturnValue([mediaWithStorageId])
    mockCreateBlobUrl.mockResolvedValue('blob:http://localhost/test-blob')
    
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Test content',
        media: []
      },
      objectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '',
        media: []
      },
      topics: [],
      assessmentPage: {
        id: 'assessment',
        title: 'Assessment',
        questions: []
      }
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
    
    // FAILING TEST: Currently using media.id instead of media.storageId
    // This test should fail first (RED phase of TDD)
    expect(mockCreateBlobUrl).toHaveBeenCalledWith('storage-456')
    expect(mockCreateBlobUrl).not.toHaveBeenCalledWith('media-123')
  })
  
  const mockPages = [
    {
      id: 'page-1',
      type: 'page' as const,
      content: {
        title: 'Page with Image',
        text: 'Content',
        mediaId: 'image-123',
        mediaType: 'image' as const
      }
    },
    {
      id: 'page-2',
      type: 'page' as const,
      content: {
        title: 'Page with Video',
        text: 'Content',
        mediaId: 'video-456',
        mediaType: 'video' as const
      }
    },
    {
      id: 'page-3',
      type: 'page' as const,
      content: {
        title: 'Page without Media',
        text: 'Just text content'
      }
    }
  ]
  
  it('should display media preview in page thumbnails', () => {
    render(
      <PageThumbnailGrid
        pages={mockPages}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Check for image preview in first page
    const page1Thumbnail = screen.getByText('Page with Image').closest('[role="button"], [role="article"]')
    expect(page1Thumbnail).toBeInTheDocument()
    
    // Should have image preview
    const imagePreview = page1Thumbnail?.querySelector('img, [role="img"]')
    expect(imagePreview).toBeInTheDocument()
    
    if (imagePreview && 'src' in imagePreview) {
      expect(imagePreview.src).toContain('blob:mock-url-image-123')
    }
  })
  
  it('should show video thumbnail or indicator for video pages', () => {
    render(
      <PageThumbnailGrid
        pages={mockPages}
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
        pages={mockPages}
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
  
  it('should maintain aspect ratio for media previews', () => {
    render(
      <PageThumbnailGrid
        pages={mockPages}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Get all media previews
    const mediaPreviews = screen.getAllByRole('img', { hidden: true })
    
    mediaPreviews.forEach(preview => {
      const styles = window.getComputedStyle(preview)
      
      // Should maintain aspect ratio
      expect(styles.objectFit).toMatch(/cover|contain|scale-down/)
      
      // Should have defined dimensions
      const width = parseFloat(styles.width)
      const height = parseFloat(styles.height)
      
      expect(width).toBeGreaterThan(0)
      expect(height).toBeGreaterThan(0)
      
      // Should not be stretched
      if (styles.maxWidth !== 'none') {
        expect(parseFloat(styles.maxWidth)).toBeGreaterThan(0)
      }
    })
  })
  
  it('should show media type indicator overlay', () => {
    render(
      <PageThumbnailGrid
        pages={mockPages}
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
  
  it('should handle loading states for media previews', () => {
    render(
      <PageThumbnailGrid
        pages={mockPages}
        currentPageId="page-1"
        onPageSelect={vi.fn()}
      />
    )
    
    // Check for loading indicators or lazy loading
    const images = screen.getAllByRole('img', { hidden: true })
    
    images.forEach(img => {
      // Should have loading attribute for performance
      expect(img).toHaveAttribute('loading')
      
      // Should have alt text for accessibility
      expect(img).toHaveAttribute('alt')
    })
  })
})