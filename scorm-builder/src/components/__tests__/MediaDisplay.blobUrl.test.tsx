import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaDisplay } from '../MediaDisplay'
import { UnifiedMediaProvider } from '../../contexts/UnifiedMediaContext'
import { vi } from 'vitest'

// Mock the MediaService
vi.mock('../../services/MediaService', () => {
  const mockMediaService = {
    getMedia: vi.fn().mockResolvedValue({
      id: 'image-0',
      type: 'image',
      data: new Blob(['test'], { type: 'image/jpeg' }),
      metadata: {
        mimeType: 'image/jpeg',
        type: 'image'
      }
    }),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    listMedia: vi.fn().mockResolvedValue([{
      id: 'image-0',
      type: 'image',
      pageId: 'test-page',
      metadata: {
        mimeType: 'image/jpeg',
        type: 'image'
      }
    }]),
    listAllMedia: vi.fn().mockResolvedValue([{
      id: 'image-0',
      type: 'image',
      pageId: 'test-page',
      metadata: {
        mimeType: 'image/jpeg',
        type: 'image'
      }
    }])
  }
  
  return {
    MediaService: vi.fn().mockImplementation(() => mockMediaService),
    createMediaService: vi.fn().mockReturnValue(mockMediaService)
  }
})

describe('MediaDisplay - Blob URL Creation', () => {
  it('should create and display blob URL for stored media', async () => {
    const TestComponent = () => (
      <UnifiedMediaProvider projectId="test-project">
        <MediaDisplay mediaId="image-0" alt="Test image" />
      </UnifiedMediaProvider>
    )

    render(<TestComponent />)

    // Wait for the image to load with blob URL
    await waitFor(() => {
      const img = screen.getByRole('img', { name: 'Test image' })
      expect(img).toBeInTheDocument()
      
      // Check that src is a blob URL
      const src = img.getAttribute('src')
      expect(src).toBeTruthy()
      expect(src).not.toBe('')
      expect(src).toMatch(/^blob:/)
    })
  })

  it('should not render img tag with empty src', async () => {
    const TestComponent = () => (
      <UnifiedMediaProvider projectId="test-project">
        <MediaDisplay mediaId={undefined} alt="Test image" />
      </UnifiedMediaProvider>
    )

    render(<TestComponent />)

    // Should not render an img tag when no mediaId
    await waitFor(() => {
      const img = screen.queryByRole('img')
      expect(img).not.toBeInTheDocument()
    })
  })
})