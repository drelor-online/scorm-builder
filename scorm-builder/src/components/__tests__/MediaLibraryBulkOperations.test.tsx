import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MediaLibrary } from '../MediaLibrary'

describe('Media Library Bulk Operations', () => {
  const mockItems = [
    {
      id: '1',
      name: 'image1.jpg',
      type: 'image' as const,
      url: '/image1.jpg',
      size: 1024,
      uploadedAt: new Date()
    },
    {
      id: '2',
      name: 'image2.jpg',
      type: 'image' as const,
      url: '/image2.jpg',
      size: 2048,
      uploadedAt: new Date()
    },
    {
      id: '3',
      name: 'video1.mp4',
      type: 'video' as const,
      url: '/video1.mp4',
      size: 1048576,
      uploadedAt: new Date()
    }
  ]

  describe('Select All/Deselect All', () => {
    it('should show Select All button when items exist', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      expect(selectAllButton).toBeInTheDocument()
    })

    it('should select all items when Select All is clicked', () => {
      const mockOnSelect = vi.fn()
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={mockOnSelect}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      fireEvent.click(selectAllButton)

      // All checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked()
      })

      // Should show count of selected items
      expect(screen.getByText(/3 items selected/i)).toBeInTheDocument()
    })

    it('should change to Deselect All when items are selected', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Click Select All
      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      fireEvent.click(selectAllButton)

      // Button should now say Deselect All
      expect(screen.getByRole('button', { name: /deselect all/i })).toBeInTheDocument()
    })

    it('should deselect all items when Deselect All is clicked', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select all first
      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      fireEvent.click(selectAllButton)

      // Then deselect all
      const deselectAllButton = screen.getByRole('button', { name: /deselect all/i })
      fireEvent.click(deselectAllButton)

      // All checkboxes should be unchecked
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked()
      })
    })
  })

  describe('Bulk Delete', () => {
    it('should show bulk delete button when items are selected', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Initially no bulk delete button
      expect(screen.queryByRole('button', { name: /delete selected/i })).not.toBeInTheDocument()

      // Select an item
      const firstCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(firstCheckbox)

      // Now bulk delete should appear
      expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument()
    })

    it('should show confirmation dialog for bulk delete', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select items
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      // Click bulk delete
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i })
      fireEvent.click(bulkDeleteButton)

      // Should show confirmation with count
      expect(screen.getByText(/delete 2 selected items/i)).toBeInTheDocument()
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
    })

    it('should delete all selected items when confirmed', async () => {
      const mockOnDelete = vi.fn()
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={mockOnDelete}
          multiSelect={true}
        />
      )

      // Select first two items
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      // Click bulk delete
      const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i })
      fireEvent.click(bulkDeleteButton)

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      fireEvent.click(confirmButton)

      // Should call onDelete for each selected item
      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledTimes(2)
        expect(mockOnDelete).toHaveBeenCalledWith('1')
        expect(mockOnDelete).toHaveBeenCalledWith('2')
      })
    })

    it('should show progress during bulk delete', async () => {
      const mockOnDelete = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )
      
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={mockOnDelete}
          multiSelect={true}
        />
      )

      // Select all items
      fireEvent.click(screen.getByRole('button', { name: /select all/i }))

      // Start bulk delete
      fireEvent.click(screen.getByRole('button', { name: /delete selected/i }))
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

      // Should show progress
      expect(screen.getByText(/deleting.*1.*of.*3/i)).toBeInTheDocument()
    })
  })

  describe('Download Selected', () => {
    it('should show download button when items are selected', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select an item
      const firstCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(firstCheckbox)

      // Download button should appear
      expect(screen.getByRole('button', { name: /download selected/i })).toBeInTheDocument()
    })

    it('should download single file directly', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select one item
      const firstCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(firstCheckbox)

      // Click download
      const downloadButton = screen.getByRole('button', { name: /download selected/i })
      
      // Create a spy for creating download links
      const createElementSpy = vi.spyOn(document, 'createElement')
      fireEvent.click(downloadButton)

      // Should create a download link
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('should create zip for multiple files', async () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select multiple items
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      // Click download
      const downloadButton = screen.getByRole('button', { name: /download selected/i })
      fireEvent.click(downloadButton)

      // Should show progress for zip creation
      expect(screen.getByText(/preparing download/i)).toBeInTheDocument()
    })
  })

  describe('Selection Persistence', () => {
    it('should maintain selection when filtering', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select first item
      const firstCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(firstCheckbox)

      // Filter by images
      const imagesFilter = screen.getByRole('button', { name: /images/i })
      fireEvent.click(imagesFilter)

      // Selection count should still show
      expect(screen.getByText(/1 item selected/i)).toBeInTheDocument()
    })

    it('should show selected count even when selected items are filtered out', () => {
      render(
        <MediaLibrary
          items={mockItems}
          onSelect={vi.fn()}
          onUpload={vi.fn()}
          onDelete={vi.fn()}
          multiSelect={true}
        />
      )

      // Select video item
      const videoCheckbox = screen.getAllByRole('checkbox')[2]
      fireEvent.click(videoCheckbox)

      // Filter to show only images
      const imagesFilter = screen.getByRole('button', { name: /images/i })
      fireEvent.click(imagesFilter)

      // Should still show selection count
      expect(screen.getByText(/1 item selected.*not visible/i)).toBeInTheDocument()
    })
  })
})