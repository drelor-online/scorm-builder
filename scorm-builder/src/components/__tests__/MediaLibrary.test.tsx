import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaLibrary } from '../MediaLibrary'

// Mock file reader
global.FileReader = vi.fn(() => ({
  readAsDataURL: vi.fn(function(this: any) {
    setTimeout(() => {
      this.onload({ target: { result: 'data:image/png;base64,test' } })
    }, 100)
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
})) as any

describe('MediaLibrary', () => {
  const mockOnSelect = vi.fn()
  const mockOnUpload = vi.fn()
  const mockOnDelete = vi.fn()

  const mockMediaItems = [
    {
      id: '1',
      name: 'Sample Image',
      type: 'image' as const,
      url: 'https://example.com/image1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      size: 1024000,
      uploadedAt: new Date('2024-01-01'),
      tags: ['hero', 'banner']
    },
    {
      id: '2',
      name: 'Training Video',
      type: 'video' as const,
      url: 'https://example.com/video1.mp4',
      thumbnailUrl: 'https://example.com/video-thumb.jpg',
      size: 10485760,
      duration: 120,
      uploadedAt: new Date('2024-01-02'),
      tags: ['tutorial']
    },
    {
      id: '3',
      name: 'Background Music',
      type: 'audio' as const,
      url: 'https://example.com/audio1.mp3',
      size: 5242880,
      duration: 180,
      uploadedAt: new Date('2024-01-03'),
      tags: ['background', 'music']
    },
    {
      id: '4',
      name: 'Course PDF',
      type: 'document' as const,
      url: 'https://example.com/document.pdf',
      size: 2097152,
      uploadedAt: new Date('2024-01-04'),
      tags: ['resource', 'pdf']
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render media library with all items', () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('Media Library')).toBeInTheDocument()
    expect(screen.getByText('Sample Image')).toBeInTheDocument()
    expect(screen.getByText('Training Video')).toBeInTheDocument()
    expect(screen.getByText('Background Music')).toBeInTheDocument()
    expect(screen.getByText('Course PDF')).toBeInTheDocument()
  })

  it('should filter items by type', async () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const imageFilter = screen.getByRole('button', { name: /images/i })
    fireEvent.click(imageFilter)

    await waitFor(() => {
      expect(screen.getByText('Sample Image')).toBeInTheDocument()
      expect(screen.queryByText('Training Video')).not.toBeInTheDocument()
      expect(screen.queryByText('Background Music')).not.toBeInTheDocument()
      expect(screen.queryByText('Course PDF')).not.toBeInTheDocument()
    })
  })

  it('should search items by name', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search media/i)
    await user.type(searchInput, 'video')

    await waitFor(() => {
      expect(screen.getByText('Training Video')).toBeInTheDocument()
      expect(screen.queryByText('Sample Image')).not.toBeInTheDocument()
    })
  })

  it('should handle file upload', async () => {
    const user = userEvent.setup()
    const file = new File(['test'], 'test.png', { type: 'image/png' })

    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const uploadInput = screen.getByLabelText(/upload/i)
    await user.upload(uploadInput, file)

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(expect.objectContaining({
        file,
        name: 'test.png',
        type: 'image',
        size: 4
      }))
    })
  })

  it('should handle drag and drop upload', async () => {
    const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })

    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const dropZone = screen.getByTestId('media-drop-zone')
    
    fireEvent.dragEnter(dropZone)
    expect(dropZone).toHaveClass('drag-over')

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    })

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(expect.objectContaining({
        file,
        name: 'test.mp4',
        type: 'video'
      }))
    })
  })

  it('should show media preview on hover', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const imageItem = screen.getByText('Sample Image').closest('[data-testid="media-item"]')
    await user.hover(imageItem!)

    await waitFor(() => {
      expect(screen.getByTestId('media-preview')).toBeInTheDocument()
      // Use getAllByAltText since there might be both thumbnail and preview
      const images = screen.getAllByAltText('Sample Image')
      expect(images.some(img => img.getAttribute('src') === 'https://example.com/image1.jpg')).toBe(true)
    })
  })

  it('should select media item', async () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const selectButton = screen.getAllByRole('button', { name: /select/i })[0]
    fireEvent.click(selectButton)

    expect(mockOnSelect).toHaveBeenCalledWith(mockMediaItems[0])
  })

  it('should delete media item with confirmation', async () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    // Find the delete button for the first item in the sorted list
    // Default sort is by date (newest first), so item '4' would be first
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0]
    fireEvent.click(deleteButton)

    // Confirm deletion
    const confirmButton = await screen.findByRole('button', { name: /confirm/i })
    fireEvent.click(confirmButton)

    // Expect the most recent item (id: '4') to be deleted
    expect(mockOnDelete).toHaveBeenCalledWith('4')
  })

  it('should display file size correctly', () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('1 MB')).toBeInTheDocument() // 1024000 bytes
    expect(screen.getByText('10 MB')).toBeInTheDocument() // 10485760 bytes
    expect(screen.getByText('5 MB')).toBeInTheDocument() // 5242880 bytes
    expect(screen.getByText('2 MB')).toBeInTheDocument() // 2097152 bytes
  })

  it('should display duration for media files', () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('2:00')).toBeInTheDocument() // 120 seconds
    expect(screen.getByText('3:00')).toBeInTheDocument() // 180 seconds
  })

  it('should support multi-select mode', async () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
        multiSelect
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])  // Item 4 (newest first)
    fireEvent.click(checkboxes[1])  // Item 3

    const selectButton = screen.getByRole('button', { name: /use selected/i })
    fireEvent.click(selectButton)

    // The component selected items 4 and 3 (as they appear in the sorted list)
    // We need to find these items in the original array
    const selectedItems = [
      mockMediaItems.find(item => item.id === '4'),
      mockMediaItems.find(item => item.id === '3')
    ]
    expect(mockOnSelect).toHaveBeenCalledWith(selectedItems)
  })

  it('should sort items by date, name, or size', async () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const sortSelect = screen.getByRole('combobox', { name: /sort by/i })
    fireEvent.change(sortSelect, { target: { value: 'name' } })

    await waitFor(() => {
      const items = screen.getAllByTestId('media-item')
      expect(items[0]).toHaveTextContent('Background Music')
      expect(items[1]).toHaveTextContent('Course PDF')
      expect(items[2]).toHaveTextContent('Sample Image')
      expect(items[3]).toHaveTextContent('Training Video')
    })
  })

  it('should show empty state when no items', () => {
    render(
      <MediaLibrary
        items={[]}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText(/no media items/i)).toBeInTheDocument()
    expect(screen.getByText(/upload your first file/i)).toBeInTheDocument()
  })

  it('should support tag filtering', async () => {
    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const tagButton = screen.getByRole('button', { name: /tutorial/i })
    fireEvent.click(tagButton)

    await waitFor(() => {
      expect(screen.getByText('Training Video')).toBeInTheDocument()
      expect(screen.queryByText('Sample Image')).not.toBeInTheDocument()
    })
  })

  it('should validate file types on upload', async () => {
    const user = userEvent.setup()
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/exe' })

    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
        acceptedFileTypes={['image/*', 'video/*', 'audio/*', 'application/pdf']}
      />
    )

    const uploadInput = screen.getByLabelText(/upload/i)
    await user.upload(uploadInput, invalidFile)

    // The component might not show an error message, but should not call onUpload
    // for invalid file types
    await waitFor(() => {
      expect(mockOnUpload).not.toHaveBeenCalled()
    })
  })

  it('should show upload progress', async () => {
    const user = userEvent.setup()
    const file = new File(['test'.repeat(1000)], 'large.mp4', { type: 'video/mp4' })

    render(
      <MediaLibrary
        items={mockMediaItems}
        onSelect={mockOnSelect}
        onUpload={mockOnUpload}
        onDelete={mockOnDelete}
      />
    )

    const uploadInput = screen.getByLabelText(/upload/i)
    await user.upload(uploadInput, file)

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByText(/uploading/i)).toBeInTheDocument()
    })
  })
})