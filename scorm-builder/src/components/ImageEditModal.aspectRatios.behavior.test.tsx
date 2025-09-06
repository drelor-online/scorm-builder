import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImageEditModal } from './ImageEditModal'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

const mockOnClose = vi.fn()
const mockOnImageUpdated = vi.fn()
const mockUpdateMedia = vi.fn()
const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()

// Mock UnifiedMediaContext
vi.mock('../contexts/UnifiedMediaContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useUnifiedMedia: () => ({
      updateMedia: mockUpdateMedia
    })
  }
})

// Mock NotificationContext
vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNotifications: () => ({
      success: mockShowSuccess,
      error: mockShowError
    })
  }
})

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PersistentStorageProvider>
      <NotificationProvider>
        <UnifiedMediaProvider>
          {children}
        </UnifiedMediaProvider>
      </NotificationProvider>
    </PersistentStorageProvider>
  )
}

describe('ImageEditModal - Aspect Ratios', () => {
  const testImageURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all aspect ratio buttons', () => {
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

    // Check that all aspect ratio buttons are present
    expect(screen.getByRole('button', { name: /crop to square aspect ratio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crop to standard aspect ratio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crop to widescreen aspect ratio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /free-form cropping/i })).toBeInTheDocument()
  })

  it('should start with Free-form selected by default', () => {
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

    const freeButton = screen.getByRole('button', { name: /free-form cropping/i })
    expect(freeButton).toHaveClass(/primary/) // Should be primary variant when selected
  })

  it('should highlight the selected aspect ratio button', () => {
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

    // Click 1:1 button
    const squareButton = screen.getByRole('button', { name: /crop to square aspect ratio/i })
    fireEvent.click(squareButton)

    // Verify it gets highlighted (primary variant)
    expect(squareButton).toHaveClass(/primary/)

    // Verify other buttons are not highlighted
    const freeButton = screen.getByRole('button', { name: /free-form cropping/i })
    expect(freeButton).toHaveClass(/secondary/)
  })

  it('should switch between different aspect ratios', () => {
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

    // Start with Free selected
    const freeButton = screen.getByRole('button', { name: /free-form cropping/i })
    expect(freeButton).toHaveClass(/primary/)

    // Click 4:3 button
    const standardButton = screen.getByRole('button', { name: /crop to standard aspect ratio/i })
    fireEvent.click(standardButton)

    // Verify 4:3 is now selected
    expect(standardButton).toHaveClass(/primary/)
    expect(freeButton).toHaveClass(/secondary/)

    // Click 16:9 button
    const widescreenButton = screen.getByRole('button', { name: /crop to widescreen aspect ratio/i })
    fireEvent.click(widescreenButton)

    // Verify 16:9 is now selected
    expect(widescreenButton).toHaveClass(/primary/)
    expect(standardButton).toHaveClass(/secondary/)
  })

  it('should display correct tooltips for each button', () => {
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

    expect(screen.getByRole('button', { name: /crop to square aspect ratio/i })).toHaveAttribute('title', 'Square (1:1)')
    expect(screen.getByRole('button', { name: /crop to standard aspect ratio/i })).toHaveAttribute('title', 'Standard (4:3)')
    expect(screen.getByRole('button', { name: /crop to widescreen aspect ratio/i })).toHaveAttribute('title', 'Widescreen (16:9)')
    expect(screen.getByRole('button', { name: /free-form cropping/i })).toHaveAttribute('title', 'Free-form')
  })

  it('should disable aspect ratio buttons when processing', async () => {
    mockUpdateMedia.mockResolvedValue({ id: 'test-image-id', url: 'updated-url' })
    
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

    // All aspect ratio buttons should be enabled initially
    expect(screen.getByRole('button', { name: /crop to square aspect ratio/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /crop to standard aspect ratio/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /crop to widescreen aspect ratio/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /free-form cropping/i })).toBeEnabled()
  })
})