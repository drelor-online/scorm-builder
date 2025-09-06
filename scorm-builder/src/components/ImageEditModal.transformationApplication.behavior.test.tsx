import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImageEditModal } from './ImageEditModal'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the media context
const mockStoreMedia = vi.fn()
const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()
const mockOnImageUpdated = vi.fn()
const mockOnClose = vi.fn()

// Create a simple test image URL (data URL)
const createTestImageURL = () => {
  // Simple 1x1 pixel red PNG data URL
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationProvider>
    <UnifiedMediaProvider>
      {children}
    </UnifiedMediaProvider>
  </NotificationProvider>
)

// Mock the contexts
vi.mock('../contexts/UnifiedMediaContext', () => ({
  ...vi.importActual('../contexts/UnifiedMediaContext'),
  useUnifiedMedia: () => ({
    storeMedia: mockStoreMedia
  })
}))

vi.mock('../contexts/NotificationContext', () => ({
  ...vi.importActual('../contexts/NotificationContext'),
  useNotifications: () => ({
    success: mockShowSuccess,
    error: mockShowError
  })
}))

describe('ImageEditModal - Transformation Application', () => {
  const testImageURL = createTestImageURL()
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreMedia.mockResolvedValue({ id: 'new-image-123', url: 'blob://new-image' })
    
    // Mock the Image constructor and canvas context for image operations
    global.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      src: string = ''
      width: number = 100
      height: number = 100
      
      constructor() {
        setTimeout(() => {
          if (this.onload) {
            this.onload()
          }
        }, 0)
      }
      
      addEventListener(event: string, handler: () => void) {
        if (event === 'load') {
          this.onload = handler
        } else if (event === 'error') {
          this.onerror = handler
        }
      }
    } as any

    // Mock canvas context
    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: vi.fn(() => ({
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockImageData')
      })),
      toBlob: vi.fn((callback) => {
        setTimeout(() => callback(new Blob(['mock image data'], { type: 'image/jpeg' })), 0)
      })
    }
    
    global.document.createElement = vi.fn((tagName) => {
      if (tagName === 'canvas') {
        return mockCanvas as any
      }
      return document.createElement(tagName)
    })
  })

  it('should apply transformations to the final saved image', async () => {
    render(
      <TestWrapper>
        <ImageEditModal
          isOpen={true}
          onClose={mockOnClose}
          imageUrl={testImageURL}
          imageTitle="Test Image"
          originalImageId="test-image-id"
          onImageUpdated={mockOnImageUpdated}
        />
      </TestWrapper>
    )

    // Wait for modal to render
    await waitFor(() => {
      expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
    })

    // Apply a flip horizontal transformation
    const flipHorizontalButton = screen.getByRole('button', { name: /flip image horizontally/i })
    fireEvent.click(flipHorizontalButton)

    // Wait for transformation to be processed
    await waitFor(() => {
      // The button should still be available (not disabled permanently)
      expect(flipHorizontalButton).not.toBeDisabled()
    })

    // Apply changes
    const applyButton = screen.getByRole('button', { name: /apply changes/i })
    fireEvent.click(applyButton)

    // Wait for the image to be processed and stored
    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalled()
    })

    // Verify that the stored media was called with a blob (the final processed image)
    expect(mockStoreMedia).toHaveBeenCalledWith(
      expect.any(Blob),
      'temp-page',
      'image',
      expect.objectContaining({
        title: expect.stringContaining('flipped horizontally')
      })
    )

    // Verify success notification and callback
    expect(mockShowSuccess).toHaveBeenCalledWith('Image edited successfully')
    expect(mockOnImageUpdated).toHaveBeenCalledWith('new-image-123', expect.stringContaining('flipped horizontally'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should apply rotation transformation to the final saved image', async () => {
    render(
      <TestWrapper>
        <ImageEditModal
          isOpen={true}
          onClose={mockOnClose}
          imageUrl={testImageURL}
          imageTitle="Test Image"
          originalImageId="test-image-id"
          onImageUpdated={mockOnImageUpdated}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
    })

    // Apply rotation
    const rotateButton = screen.getByRole('button', { name: /rotate image 90 degrees/i })
    fireEvent.click(rotateButton)

    await waitFor(() => {
      expect(rotateButton).not.toBeDisabled()
    })

    // Apply changes
    const applyButton = screen.getByRole('button', { name: /apply changes/i })
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalled()
    })

    // Verify rotation was applied in the title
    expect(mockStoreMedia).toHaveBeenCalledWith(
      expect.any(Blob),
      'temp-page',
      'image',
      expect.objectContaining({
        title: expect.stringContaining('rotated 90°')
      })
    )
  })

  it('should apply multiple transformations to the final saved image', async () => {
    render(
      <TestWrapper>
        <ImageEditModal
          isOpen={true}
          onClose={mockOnClose}
          imageUrl={testImageURL}
          imageTitle="Test Image"
          originalImageId="test-image-id"
          onImageUpdated={mockOnImageUpdated}
        />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
    })

    // Apply multiple transformations
    const rotateButton = screen.getByRole('button', { name: /rotate image 90 degrees/i })
    const flipHorizontalButton = screen.getByRole('button', { name: /flip image horizontally/i })
    
    fireEvent.click(rotateButton)
    fireEvent.click(flipHorizontalButton)

    await waitFor(() => {
      expect(rotateButton).not.toBeDisabled()
      expect(flipHorizontalButton).not.toBeDisabled()
    })

    // Apply changes
    const applyButton = screen.getByRole('button', { name: /apply changes/i })
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(mockStoreMedia).toHaveBeenCalled()
    })

    // Verify multiple transformations were applied
    expect(mockStoreMedia).toHaveBeenCalledWith(
      expect.any(Blob),
      'temp-page',
      'image',
      expect.objectContaining({
        title: expect.stringMatching(/rotated 90°.*flipped horizontally|flipped horizontally.*rotated 90°/)
      })
    )
  })
})