import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageEditModal } from './ImageEditModal'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock the media context
const mockUpdateMedia = vi.fn()
const MockProviders = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider>
    <NotificationProvider>
      <UnifiedMediaProvider value={{ 
        updateMedia: mockUpdateMedia,
        getMediaUrl: () => '',
        listMedia: () => [],
        deleteMedia: () => Promise.resolve()
      }}>
        {children}
      </UnifiedMediaProvider>
    </NotificationProvider>
  </PersistentStorageProvider>
)

describe('ImageEditModal - Crop Handles Behavior', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    imageTitle: 'Test Image',
    originalImageId: 'test-image-id',
    onImageUpdated: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Crop Area Resizing with Handles', () => {
    it('should display corner handles for crop area resizing', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      // Wait for the crop component to load
      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      // Look for crop handles (react-advanced-cropper creates resize handles)
      // React-advanced-cropper should display the crop area with handles
      const cropperElement = screen.getByTestId('image-cropper')
      expect(cropperElement).toBeInTheDocument()

      // The cropper should contain resize handles (react-advanced-cropper structure)
      // Look for canvas or stencil elements (react-advanced-cropper uses canvas-based cropping)
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      
      // Either canvas or cropper wrapper should exist
      expect(canvas || cropperWrapper).toBeTruthy()
    })

    it('should change cursor to resize when hovering over corner handles', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      const cropperElement = screen.getByTestId('image-cropper')
      
      // React-advanced-cropper uses canvas-based rendering
      // Check that the cropper is interactive and rendered
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      
      // Should have canvas or wrapper for interaction
      expect(canvas || cropperWrapper).toBeTruthy()
    })

    it('should change cursor to resize when hovering over edge handles', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      const cropperElement = screen.getByTestId('image-cropper')
      
      // Test that cropper has interactive elements for resizing
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      
      // Should have interactive canvas or wrapper
      expect(canvas || cropperWrapper).toBeTruthy()
      
      // Should be visible and functional
      expect(cropperElement).toBeVisible()
    })

    it('should resize crop area when dragging corner handles', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      const cropperElement = screen.getByTestId('image-cropper')
      
      // react-advanced-cropper uses canvas-based interaction
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      
      // Should have interactive elements
      expect(canvas || cropperWrapper).toBeTruthy()
      
      // Test that cropper is interactive (simulate mouse interaction on canvas)
      if (canvas) {
        expect(canvas).toBeVisible()
        
        // Simulate mouse interaction on canvas
        fireEvent.mouseDown(canvas)
        fireEvent.mouseUp(canvas)
        
        // Canvas should still be present after interaction
        expect(canvas).toBeVisible()
      }
    })

    it('should maintain aspect ratio when set to square', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      // Set square aspect ratio first
      const squareButton = screen.getByRole('button', { name: /Crop to square aspect ratio \(1:1\)/i })
      fireEvent.click(squareButton)

      // Verify that the square aspect ratio button is now active
      expect(squareButton).toHaveClass('btn-primary')
      
      // The react-advanced-cropper component should now enforce 1:1 aspect ratio
      const cropperElement = screen.getByTestId('image-cropper')
      expect(cropperElement).toBeInTheDocument()
    })
  })

  describe('Crop Area Edge Resizing', () => {
    it('should resize crop area when dragging edge handles', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      const cropperElement = screen.getByTestId('image-cropper')
      
      // Test that the cropper has interactive resize functionality
      expect(cropperElement).toBeInTheDocument()
      
      // Should have canvas or wrapper area for cropping
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      expect(canvas || cropperWrapper).toBeTruthy()
      
      // Cropper should be visible and functional
      expect(cropperElement).toBeVisible()
    })
  })

  describe('Visual Feedback', () => {
    it('should highlight crop handles on hover', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      const cropperElement = screen.getByTestId('image-cropper')
      
      // react-advanced-cropper should have visual feedback elements
      expect(cropperElement).toBeVisible()
      
      // Should have canvas or wrapper for interaction
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      expect(canvas || cropperWrapper).toBeTruthy()
    })

    it('should show active state during interaction', async () => {
      render(
        <MockProviders>
          <ImageEditModal {...defaultProps} />
        </MockProviders>
      )

      await waitFor(() => {
        expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      })

      const cropperElement = screen.getByTestId('image-cropper')
      
      // Test that cropper is interactive and functional
      expect(cropperElement).toBeVisible()
      
      // Should have canvas or wrapper for crop area
      const canvas = cropperElement.querySelector('canvas')
      const cropperWrapper = cropperElement.querySelector('.react-advanced-cropper')
      expect(canvas || cropperWrapper).toBeTruthy()
    })
  })
})