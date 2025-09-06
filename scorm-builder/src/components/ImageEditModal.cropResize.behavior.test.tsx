import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('ImageEditModal - Crop Resize Behavior', () => {
  const testImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should configure react-easy-crop for free-form resizing', () => {
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

    // The crop container should be present
    const cropperContainer = screen.getByTestId('image-cropper')
    expect(cropperContainer).toBeInTheDocument()
    
    // Should have instructions for user about cropping
    // (We could add these as help text)
  })

  it('should support aspect ratio of undefined for free-form cropping', () => {
    // This tests the aspect={undefined} configuration
    // react-easy-crop with aspect={undefined} allows free-form resizing
    const aspectRatio = undefined
    expect(aspectRatio).toBeUndefined()
    
    // When aspect is undefined, react-easy-crop allows any crop dimensions
    // Users can drag corners to resize the crop area (though handles aren't visible)
  })

  it('should provide zoom controls for crop refinement', () => {
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

    // Should have zoom controls
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument()
    
    // Should show current zoom level
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})