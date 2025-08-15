/**
 * MediaDisplay - Core Rendering Tests
 * 
 * Extracted from MediaDisplay.consolidated.test.tsx
 * Covers: Core rendering and fallback behavior
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

// Mock the MediaContext
const mockGetMediaUrl = vi.fn()
const mockGetMedia = vi.fn()
const mockStore = {
  getMedia: mockGetMedia,
  getMediaForPage: vi.fn(() => []),
  createBlobUrl: mockGetMediaUrl,
  getAllMedia: vi.fn(() => [])
}

const mockMediaContext = {
  ...mockStore,
  createBlobUrl: mockGetMediaUrl,
  storeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  isLoading: false,
  error: null,
  clearError: vi.fn(),
  refreshMedia: vi.fn()
}

vi.mock('../../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: any) => children,
  useUnifiedMedia: () => mockMediaContext
}))

describe('MediaDisplay - Core Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default mock behaviors
    mockGetMediaUrl.mockResolvedValue('blob:mock-url')
    mockGetMedia.mockResolvedValue({
      data: new Uint8Array([1, 2, 3, 4]),
      metadata: { mimeType: 'image/jpeg', filename: 'test.jpg' }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Fallback Behavior', () => {
    it('returns fallback when no mediaId provided', () => {
      render(<MediaDisplay fallback={<div>No media</div>} />)
      expect(screen.getByText('No media')).toBeInTheDocument()
    })

    it('returns fallback when mediaId is empty string', () => {
      render(<MediaDisplay mediaId="" fallback={<div>No media</div>} />)
      expect(screen.getByText('No media')).toBeInTheDocument()
    })

    it('returns fallback when mediaId is null', () => {
      render(<MediaDisplay mediaId={null as any} fallback={<div>No media</div>} />)
      expect(screen.getByText('No media')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner when media is loading', () => {
      mockMediaContext.isLoading = true
      render(<MediaDisplay mediaId="loading-media" />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Basic Rendering', () => {
    it('renders image when media URL is available', async () => {
      render(<MediaDisplay mediaId="test-image" />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toBeInTheDocument()
        expect(image).toHaveAttribute('src', 'blob:mock-url')
      })
    })

    it('renders image with alt text', async () => {
      render(<MediaDisplay mediaId="test-image" alt="Test image" />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveAttribute('alt', 'Test image')
      })
    })

    it('applies custom className to image', async () => {
      render(<MediaDisplay mediaId="test-image" className="custom-class" />)
      
      await waitFor(() => {
        const image = screen.getByRole('img')
        expect(image).toHaveClass('custom-class')
      })
    })

    it('passes through additional props to image element', async () => {
      render(<MediaDisplay mediaId="test-image" data-testid="custom-image" />)
      
      await waitFor(() => {
        const image = screen.getByTestId('custom-image')
        expect(image).toBeInTheDocument()
      })
    })
  })
})