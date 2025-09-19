/**
 * TDD Test: MediaLoadingOverlay Cancel Button Functionality
 *
 * This test reproduces the user's issue where they get stuck in loading
 * with no way to cancel. We need to add a cancel button that allows users
 * to abort loading operations and reset the UI state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaLoadingOverlay } from './MediaLoadingOverlay'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { MockFileStorage } from '../services/MockFileStorage'

// Mock the media hook to provide a controllable loading state
const mockUseMedia = vi.fn()
vi.mock('../hooks/useMedia', () => ({
  useMedia: () => mockUseMedia()
}))

describe('MediaLoadingOverlay Cancel Button', () => {
  let mockFileStorage: MockFileStorage
  let mockOnCancel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFileStorage = new MockFileStorage()
    mockOnCancel = vi.fn()

    // Reset the mock to return loading state
    mockUseMedia.mockReturnValue({
      isLoading: true,
      error: null
    })
  })

  it('should render cancel button when loading', () => {
    // Arrange - Component is in loading state (mocked above)

    // Act - Render the overlay with cancel functionality
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider storage={mockFileStorage} projectId="test-project">
          <MediaLoadingOverlay
            message="Loading media files..."
            onCancel={mockOnCancel}
            showCancel={true}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Assert - Cancel button should be visible
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByText('Loading media files...')).toBeInTheDocument()
  })

  it('should call onCancel when cancel button is clicked', async () => {
    // Arrange
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider storage={mockFileStorage} projectId="test-project">
          <MediaLoadingOverlay
            message="Loading image-2.json..."
            onCancel={mockOnCancel}
            showCancel={true}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Act - Click the cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    // Assert - onCancel should be called
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  it('should not render cancel button when showCancel is false', () => {
    // Arrange & Act
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider storage={mockFileStorage} projectId="test-project">
          <MediaLoadingOverlay
            message="Loading media..."
            onCancel={mockOnCancel}
            showCancel={false}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Assert - Cancel button should not be present
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('should not render overlay when not loading', () => {
    // Arrange - Mock not loading state
    mockUseMedia.mockReturnValue({
      isLoading: false,
      error: null
    })

    // Act
    const { container } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider storage={mockFileStorage} projectId="test-project">
          <MediaLoadingOverlay
            message="Loading..."
            onCancel={mockOnCancel}
            showCancel={true}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Assert - Overlay should not be rendered when not loading
    expect(container.firstChild).toBeNull()
  })

  it('should show appropriate styling for cancel button', () => {
    // Arrange & Act
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider storage={mockFileStorage} projectId="test-project">
          <MediaLoadingOverlay
            message="Loading stuck media..."
            onCancel={mockOnCancel}
            showCancel={true}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Assert - Cancel button should have proper styling/accessibility
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    expect(cancelButton).toBeInTheDocument()
    expect(cancelButton).toBeEnabled()

    // Should have appropriate ARIA attributes for accessibility
    expect(cancelButton).toHaveAttribute('type', 'button')
  })

  it('should allow cancelling when media loading gets stuck', async () => {
    // Arrange - Simulate the stuck loading scenario user experienced
    render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider storage={mockFileStorage} projectId="test-project">
          <MediaLoadingOverlay
            message="Loading C:\\Users\\sierr\\Desktop\\image-2.json..."
            onCancel={mockOnCancel}
            showCancel={true}
          />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Verify we're in the stuck state (loading shown)
    expect(screen.getByText(/Loading.*image-2\.json/)).toBeInTheDocument()

    // Act - User clicks cancel to escape stuck loading
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    // Assert - Cancel handler is called to reset the state
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })
})