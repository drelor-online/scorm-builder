import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import MediaEnhancementWizard from './MediaEnhancementWizard'
import { AllTheProviders } from '../test/TestProviders'
import type { CourseContent } from '../types/aiPrompt'

// Mock all required contexts and services
vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    createBlobUrl: vi.fn().mockResolvedValue('blob:mock-image-url'),
    storeMediaBlob: vi.fn().mockResolvedValue({ id: 'mock-image-id', title: 'Test Image' }),
    deleteMedia: vi.fn(),
    listMedia: vi.fn().mockResolvedValue([])
  }),
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    saveCourseSeedData: vi.fn(),
    saveProject: vi.fn()
  }),
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markAsUnsaved: vi.fn(),
    markAsSaved: vi.fn(),
    hasUnsavedChanges: false
  }),
  UnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    show: vi.fn()
  }),
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({}),
  StepNavigationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../contexts/AutoSaveContext', () => ({
  useAutoSave: () => ({}),
  AutoSaveProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const mockCourseContent: CourseContent = {
  id: 'course-1',
  title: 'Test Course',
  description: 'Test Description',
  pages: [
    {
      id: 'page-1',
      title: 'Page 1',
      content: 'Test content',
      media: [
        {
          id: 'image-1',
          title: 'Test Image',
          type: 'image',
          url: 'https://example.com/test-image.jpg',
          alt: 'Test alt text'
        }
      ]
    }
  ],
  topics: []
}

describe('MediaEnhancementWizard - Image Edit Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  it('should show Edit button for images in media preview', async () => {
    render(
      <AllTheProviders>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </AllTheProviders>
    )

    // Wait for component to load and show media
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })

    // Should show Edit button for the image
    const editButton = screen.getByLabelText(/edit.*image/i)
    expect(editButton).toBeInTheDocument()
    expect(editButton).toBeEnabled()
  })

  it('should open ImageEditModal when Edit button is clicked', async () => {
    render(
      <AllTheProviders>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </AllTheProviders>
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })

    // Click the Edit button
    const editButton = screen.getByLabelText(/edit.*image/i)
    fireEvent.click(editButton)

    // Should open the ImageEditModal
    await waitFor(() => {
      expect(screen.getByText('Edit Image')).toBeInTheDocument()
      expect(screen.getByText('Crop')).toBeInTheDocument()
      expect(screen.getByText('Rotate')).toBeInTheDocument()
      expect(screen.getByText('Flip Horizontal')).toBeInTheDocument()
      expect(screen.getByText('Flip Vertical')).toBeInTheDocument()
    })
  })

  it('should show image crop interface with selection area', async () => {
    render(
      <AllTheProviders>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </AllTheProviders>
    )

    // Open edit modal
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByLabelText(/edit.*image/i))

    // Should show crop interface
    await waitFor(() => {
      expect(screen.getByTestId('image-cropper')).toBeInTheDocument()
      expect(screen.getByTestId('crop-selection-area')).toBeInTheDocument()
    })
  })

  it('should rotate image when rotate button is clicked', async () => {
    const onUpdateContent = vi.fn()
    
    render(
      <AllTheProviders>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={onUpdateContent}
        />
      </AllTheProviders>
    )

    // Open edit modal
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByLabelText(/edit.*image/i))

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Edit Image')).toBeInTheDocument()
    })

    // Click rotate button
    const rotateButton = screen.getByText('Rotate')
    fireEvent.click(rotateButton)

    // Should trigger content update with rotated image
    await waitFor(() => {
      expect(onUpdateContent).toHaveBeenCalled()
    })
  })

  it('should save edited image with descriptive name when Apply is clicked', async () => {
    const onUpdateContent = vi.fn()
    
    render(
      <AllTheProviders>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onNext={vi.fn()}
          onBack={vi.fn()}
          onUpdateContent={onUpdateContent}
        />
      </AllTheProviders>
    )

    // Open edit modal and make edits
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByLabelText(/edit.*image/i))

    await waitFor(() => {
      expect(screen.getByText('Edit Image')).toBeInTheDocument()
    })

    // Make some edits
    fireEvent.click(screen.getByText('Rotate'))
    fireEvent.click(screen.getByText('Flip Horizontal'))

    // Apply changes
    const applyButton = screen.getByText('Apply Changes')
    fireEvent.click(applyButton)

    // Should create new media entry with descriptive name
    await waitFor(() => {
      expect(onUpdateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          pages: expect.arrayContaining([
            expect.objectContaining({
              media: expect.arrayContaining([
                expect.objectContaining({
                  title: expect.stringMatching(/Test Image.*edited/i)
                })
              ])
            })
          ])
        })
      )
    })
  })

  it('should show Edit button in lightbox for images', async () => {
    render(
      <AllTheProviders>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </AllTheProviders>
    )

    // Open lightbox by clicking on image
    await waitFor(() => {
      expect(screen.getByText('Test Image')).toBeInTheDocument()
    })

    // Click on image to open lightbox
    const imagePreview = screen.getByAltText('Test alt text')
    fireEvent.click(imagePreview)

    // Should show Edit button in lightbox
    await waitFor(() => {
      expect(screen.getByTestId('lightbox-modal')).toBeInTheDocument()
      expect(screen.getByLabelText(/edit.*image/i)).toBeInTheDocument()
    })
  })
})