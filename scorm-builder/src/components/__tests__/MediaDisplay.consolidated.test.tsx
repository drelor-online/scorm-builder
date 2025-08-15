/**
 * MediaDisplay - Consolidated Test Suite
 * 
 * This file consolidates MediaDisplay tests from 4 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - MediaDisplay.test.tsx (main functionality)
 * - MediaDisplay.blobUrl.test.tsx (blob URL creation and management)
 * - MediaDisplay.blobUrlCreation.test.tsx (blob URL lifecycle)
 * - MediaDisplay.integration.test.tsx (integration with media services)
 * 
 * Test Categories:
 * - Core rendering and fallback behavior
 * - Media URL generation and blob handling
 * - Blob URL lifecycle management and cleanup
 * - Integration with MediaService and UnifiedMediaContext
 * - Loading states and error handling
 * - Different media types (image, video, audio)
 * - Memory management and cleanup
 * - Edge cases and error scenarios
 */

import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaDisplay } from '../MediaDisplay'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'

// Mock the MediaService
const mockMediaService = {
  getMedia: vi.fn(),
  storeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  listMedia: vi.fn(),
  listAllMedia: vi.fn(),
  clearCache: vi.fn(),
  getInstance: vi.fn()
}

vi.mock('../../services/MediaService', () => ({
  MediaService: {
    getInstance: () => mockMediaService
  }
}))

// Mock the MediaContext with different scenarios
const mockGetMediaUrl = vi.fn()
const mockGetMedia = vi.fn()
const mockStore = {
  getMedia: mockGetMedia
}
let mockIsLoading = false

vi.mock('../../contexts/MediaContext', () => ({
  useMedia: () => ({
    getMediaUrl: mockGetMediaUrl,
    isLoading: mockIsLoading,
    store: mockStore
  })
}))

// Mock DesignSystem components
vi.mock('../DesignSystem', () => ({
  LoadingSpinner: ({ text }: any) => <div data-testid="loading-spinner">{text}</div>
}))

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL
  },
  writable: true
})

describe('MediaDisplay - Consolidated Test Suite', () => {
  const defaultProps = {
    mediaId: 'test-media-1',
    fallback: <div data-testid="fallback">No media available</div>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockIsLoading = false
    
    // Default mock implementations
    mockCreateObjectURL.mockReturnValue('blob:mock-url')
    mockMediaService.getMedia.mockResolvedValue({
      id: 'test-media-1',
      type: 'image',
      data: new Blob(['test'], { type: 'image/jpeg' }),
      metadata: {
        mimeType: 'image/jpeg',
        type: 'image'
      }
    })
    mockMediaService.listMedia.mockResolvedValue([])
    mockGetMediaUrl.mockReturnValue('blob:mock-url')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Core Rendering and Fallback Behavior', () => {
    it('returns fallback when no mediaId provided', () => {
      render(<MediaDisplay mediaId={undefined} fallback={<div data-testid="fallback">No media</div>} />)
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
      expect(screen.getByText('No media')).toBeInTheDocument()
    })

    it('returns fallback when mediaId is empty string', () => {
      render(<MediaDisplay mediaId="" fallback={<div data-testid="fallback">No media</div>} />)
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
    })

    it('returns fallback when mediaId is null', () => {
      render(<MediaDisplay mediaId={null as any} fallback={<div data-testid="fallback">No media</div>} />)
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
    })

    it('shows loading spinner when media is loading', () => {
      mockIsLoading = true
      
      render(<MediaDisplay {...defaultProps} />)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('renders image when media URL is available', async () => {
      render(<MediaDisplay {...defaultProps} />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toBeInTheDocument()
        expect(image).toHaveAttribute('src', 'blob:mock-url')
      })
    })

    it('renders image with alt text', async () => {
      render(<MediaDisplay {...defaultProps} alt="Test image" />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveAttribute('alt', 'Test image')
      })
    })

    it('applies custom className to image', async () => {
      render(<MediaDisplay {...defaultProps} className="custom-class" />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveClass('custom-class')
      })
    })

    it('passes through additional props to image element', async () => {
      render(<MediaDisplay {...defaultProps} data-testid="custom-image" />)
      
      await waitFor(() => {
        const image = screen.getByTestId('custom-image')
        expect(image).toBeInTheDocument()
      })
    })
  })

  describe('Media URL Generation and Blob Handling', () => {
    it('calls getMediaUrl with correct mediaId', async () => {
      render(<MediaDisplay {...defaultProps} />)
      
      await waitFor(() => {
        expect(mockGetMediaUrl).toHaveBeenCalledWith('test-media-1')
      })
    })

    it('creates blob URL for binary data', async () => {
      const blobData = new Blob(['test image data'], { type: 'image/jpeg' })
      mockMediaService.getMedia.mockResolvedValue({
        id: 'test-media-1',
        type: 'image',
        data: blobData,
        metadata: { mimeType: 'image/jpeg', type: 'image' }
      })

      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(blobData)
      })
    })

    it('handles ArrayBuffer data correctly', async () => {
      const arrayBuffer = new ArrayBuffer(8)
      mockMediaService.getMedia.mockResolvedValue({
        id: 'test-media-1',
        type: 'image',
        data: arrayBuffer,
        metadata: { mimeType: 'image/jpeg', type: 'image' }
      })

      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        // Should convert ArrayBuffer to Blob before creating URL
        expect(mockCreateObjectURL).toHaveBeenCalled()
      })
    })

    it('handles Uint8Array data correctly', async () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4])
      mockMediaService.getMedia.mockResolvedValue({
        id: 'test-media-1',
        type: 'image',
        data: uint8Array,
        metadata: { mimeType: 'image/jpeg', type: 'image' }
      })

      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled()
      })
    })

    it('preserves original MIME type in blob URL', async () => {
      const blobData = new Blob(['svg content'], { type: 'image/svg+xml' })
      mockMediaService.getMedia.mockResolvedValue({
        id: 'test-media-1',
        type: 'image',
        data: blobData,
        metadata: { mimeType: 'image/svg+xml', type: 'image' }
      })

      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'image/svg+xml' })
        )
      })
    })

    it('falls back to default MIME type when not provided', async () => {
      const blobData = new Blob(['unknown data'])
      mockMediaService.getMedia.mockResolvedValue({
        id: 'test-media-1',
        type: 'image',
        data: blobData,
        metadata: { type: 'image' }
      })

      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled()
      })
    })
  })

  describe('Blob URL Lifecycle Management and Cleanup', () => {
    it('revokes blob URL on unmount', async () => {
      const { unmount } = render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled()
      })

      unmount()
      
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('revokes old blob URL when mediaId changes', async () => {
      const { rerender } = render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled()
      })

      // Change mediaId
      rerender(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} mediaId="new-media-id" />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      })
    })

    it('does not revoke URL if it was not created by this component', async () => {
      mockGetMediaUrl.mockReturnValue('https://external-url.com/image.jpg')
      
      const { unmount } = render(<MediaDisplay {...defaultProps} />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveAttribute('src', 'https://external-url.com/image.jpg')
      })

      unmount()
      
      // Should not revoke external URLs
      expect(mockRevokeObjectURL).not.toHaveBeenCalled()
    })

    it('handles multiple rapid mediaId changes gracefully', async () => {
      const { rerender } = render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )

      // Rapid changes
      for (let i = 0; i < 5; i++) {
        rerender(
          <UnifiedMediaProvider>
            <MediaDisplay {...defaultProps} mediaId={`media-${i}`} />
          </UnifiedMediaProvider>
        )
      }
      
      // Should handle cleanup correctly
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('prevents memory leaks with proper cleanup', async () => {
      const components = []
      
      // Create multiple components
      for (let i = 0; i < 3; i++) {
        const { unmount } = render(
          <UnifiedMediaProvider>
            <MediaDisplay mediaId={`media-${i}`} fallback={<div>Fallback</div>} />
          </UnifiedMediaProvider>
        )
        components.push(unmount)
      }
      
      // Unmount all components
      components.forEach(unmount => unmount())
      
      // Should clean up all blob URLs
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(3)
    })
  })

  describe('Integration with MediaService and UnifiedMediaContext', () => {
    it('integrates with UnifiedMediaProvider correctly', async () => {
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockMediaService.getMedia).toHaveBeenCalledWith('test-media-1')
      })
    })

    it('handles MediaService errors gracefully', async () => {
      mockMediaService.getMedia.mockRejectedValue(new Error('Media not found'))
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })

    it('shows loading state while MediaService fetches data', async () => {
      mockMediaService.getMedia.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      // Should show loading initially
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('works with cached media data', async () => {
      // First call should fetch from service
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockMediaService.getMedia).toHaveBeenCalledWith('test-media-1')
      })

      // Second component with same mediaId should use cache
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      // Should not call service again due to caching
      expect(mockMediaService.getMedia).toHaveBeenCalledTimes(1)
    })

    it('updates when media data changes in context', async () => {
      const { rerender } = render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })

      // Simulate media update in context
      mockGetMediaUrl.mockReturnValue('blob:updated-url')
      
      rerender(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveAttribute('src', 'blob:updated-url')
      })
    })
  })

  describe('Loading States and Error Handling', () => {
    it('shows loading spinner with custom text', () => {
      mockIsLoading = true
      
      render(<MediaDisplay {...defaultProps} loadingText="Loading media..." />)
      
      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveTextContent('Loading media...')
    })

    it('shows default loading text when none provided', () => {
      mockIsLoading = true
      
      render(<MediaDisplay {...defaultProps} />)
      
      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toBeInTheDocument()
    })

    it('handles network errors gracefully', async () => {
      mockGetMediaUrl.mockImplementation(() => {
        throw new Error('Network error')
      })
      
      render(<MediaDisplay {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })

    it('handles invalid media data gracefully', async () => {
      mockMediaService.getMedia.mockResolvedValue(null)
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })

    it('handles corrupted blob data gracefully', async () => {
      mockCreateObjectURL.mockImplementation(() => {
        throw new Error('Invalid blob data')
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })

    it('retries on transient failures', async () => {
      mockMediaService.getMedia
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          id: 'test-media-1',
          type: 'image',
          data: new Blob(['test'], { type: 'image/jpeg' }),
          metadata: { mimeType: 'image/jpeg', type: 'image' }
        })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })
    })
  })

  describe('Different Media Types', () => {
    it('handles image media correctly', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        id: 'image-1',
        type: 'image',
        data: new Blob(['image data'], { type: 'image/png' }),
        metadata: { mimeType: 'image/png', type: 'image' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="image-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toBeInTheDocument()
      })
    })

    it('handles video media with proper element', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        id: 'video-1',
        type: 'video',
        data: new Blob(['video data'], { type: 'video/mp4' }),
        metadata: { mimeType: 'video/mp4', type: 'video' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="video-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        // Note: This test assumes MediaDisplay renders video elements for video types
        const media = screen.getByRole('img') // or video if component supports it
        expect(media).toBeInTheDocument()
      })
    })

    it('handles SVG media correctly', async () => {
      const svgData = new Blob(['<svg><rect /></svg>'], { type: 'image/svg+xml' })
      mockMediaService.getMedia.mockResolvedValue({
        id: 'svg-1',
        type: 'image',
        data: svgData,
        metadata: { mimeType: 'image/svg+xml', type: 'image' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="svg-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toBeInTheDocument()
      })
    })

    it('handles audio media appropriately', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        id: 'audio-1',
        type: 'audio',
        data: new Blob(['audio data'], { type: 'audio/mp3' }),
        metadata: { mimeType: 'audio/mp3', type: 'audio' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="audio-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      // Audio might be handled differently or fall back
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })
    })

    it('handles unknown media types gracefully', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        id: 'unknown-1',
        type: 'unknown' as any,
        data: new Blob(['unknown data'], { type: 'application/octet-stream' }),
        metadata: { mimeType: 'application/octet-stream', type: 'unknown' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="unknown-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })
  })

  describe('Memory Management and Performance', () => {
    it('does not create new blob URLs unnecessarily', async () => {
      const { rerender } = render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      })

      // Rerender with same props should not create new URL
      rerender(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    })

    it('handles large media files efficiently', async () => {
      const largeBlob = new Blob([new ArrayBuffer(1024 * 1024)], { type: 'image/jpeg' }) // 1MB
      mockMediaService.getMedia.mockResolvedValue({
        id: 'large-media-1',
        type: 'image',
        data: largeBlob,
        metadata: { mimeType: 'image/jpeg', type: 'image' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="large-media-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })
    })

    it('cleans up resources on rapid component updates', async () => {
      const { rerender, unmount } = render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <UnifiedMediaProvider>
            <MediaDisplay mediaId={`media-${i}`} fallback={<div>Fallback</div>} />
          </UnifiedMediaProvider>
        )
      }
      
      unmount()
      
      // Should properly clean up all resources
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('handles empty blob data', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        id: 'empty-1',
        type: 'image',
        data: new Blob([]),
        metadata: { mimeType: 'image/jpeg', type: 'image' }
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="empty-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })

    it('handles missing metadata gracefully', async () => {
      mockMediaService.getMedia.mockResolvedValue({
        id: 'no-metadata-1',
        type: 'image',
        data: new Blob(['data'], { type: 'image/jpeg' }),
        metadata: undefined as any
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay mediaId="no-metadata-1" fallback={<div>Fallback</div>} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })
    })

    it('handles concurrent requests for same media', async () => {
      // Render multiple components with same mediaId simultaneously
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
          <MediaDisplay {...defaultProps} />
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        const images = screen.getAllByRole('img')
        expect(images).toHaveLength(3)
      })
      
      // Should only fetch once due to deduplication
      expect(mockMediaService.getMedia).toHaveBeenCalledTimes(1)
    })

    it('handles MediaService instance unavailable', async () => {
      vi.mocked(mockMediaService.getInstance).mockReturnValue(null)
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })

    it('handles URL.createObjectURL not available', async () => {
      // Simulate environment where URL.createObjectURL is not available
      Object.defineProperty(global, 'URL', {
        value: undefined,
        writable: true
      })
      
      render(
        <UnifiedMediaProvider>
          <MediaDisplay {...defaultProps} />
        </UnifiedMediaProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
      
      // Restore URL object
      Object.defineProperty(global, 'URL', {
        value: {
          createObjectURL: mockCreateObjectURL,
          revokeObjectURL: mockRevokeObjectURL
        },
        writable: true
      })
    })
  })
})