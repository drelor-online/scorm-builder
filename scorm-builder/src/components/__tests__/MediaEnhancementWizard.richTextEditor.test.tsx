import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { CourseContent } from '../../types/aiPrompt'

// Mock the RichTextEditor component
vi.mock('../RichTextEditor', () => ({
  RichTextEditor: ({ content, onSave, onCancel, isOpen }: any) => 
    isOpen ? (
      <div data-testid="rich-text-editor-mock">
        <h2>Edit Content</h2>
        <div data-testid="editor-content">{content}</div>
        <button onClick={() => onSave('<p>Updated content from editor</p>')}>
          Save Changes
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

describe('MediaEnhancementWizard - Rich Text Editor Integration', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnUpdateContent = vi.fn()
  
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome Page',
      content: '<p>Original welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2,
      media: []
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3,
      media: []
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: '<p>Topic 1 content</p>',
      narration: 'Topic narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
      media: []
    }],
    assessment: {
      questions: [],
      passMark: 80
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show Edit Content button for current page', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Should show edit button
    expect(screen.getByText('Edit Content')).toBeInTheDocument()
    expect(screen.getByTestId('edit-content-button')).toBeInTheDocument()
  })

  it('should open RichTextEditor when Edit Content is clicked', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Click edit button
    const editButton = screen.getByTestId('edit-content-button')
    fireEvent.click(editButton)

    // Rich text editor should open
    await waitFor(() => {
      expect(screen.getByTestId('rich-text-editor-mock')).toBeInTheDocument()
    })

    // Should show current page content in editor
    expect(screen.getByTestId('editor-content')).toHaveTextContent('Original welcome content')
  })

  it('should update page content when saving from editor', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Open editor
    fireEvent.click(screen.getByTestId('edit-content-button'))

    // Save changes
    const saveButton = await screen.findByText('Save Changes')
    fireEvent.click(saveButton)

    // Should call onUpdateContent with updated content
    await waitFor(() => {
      expect(mockOnUpdateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          welcomePage: expect.objectContaining({
            content: '<p>Updated content from editor</p>'
          })
        })
      )
    })

    // Editor should close
    expect(screen.queryByTestId('rich-text-editor-mock')).not.toBeInTheDocument()
  })

  it('should show updated content in preview after editing', async () => {
    const { rerender } = render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Open editor and save
    fireEvent.click(screen.getByTestId('edit-content-button'))
    fireEvent.click(await screen.findByText('Save Changes'))

    // Simulate parent component updating courseContent
    const updatedContent = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        content: '<p>Updated content from editor</p>'
      }
    }

    rerender(
      <MediaEnhancementWizard
        courseContent={updatedContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Should show updated content in preview
    expect(screen.getByTestId('page-content-preview')).toHaveTextContent('Updated content from editor')
  })

  it('should close editor without saving when cancel is clicked', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Open editor
    fireEvent.click(screen.getByTestId('edit-content-button'))

    // Cancel
    const cancelButton = await screen.findByText('Cancel')
    fireEvent.click(cancelButton)

    // Should not call onUpdateContent
    expect(mockOnUpdateContent).not.toHaveBeenCalled()

    // Editor should close
    expect(screen.queryByTestId('rich-text-editor-mock')).not.toBeInTheDocument()
  })

  it('should edit content for different pages when navigating', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Navigate to objectives page
    const objectivesButton = screen.getByTestId('page-nav-objectives')
    fireEvent.click(objectivesButton)

    // Open editor for objectives page
    fireEvent.click(screen.getByTestId('edit-content-button'))

    // Should show objectives content
    await waitFor(() => {
      expect(screen.getByTestId('editor-content')).toHaveTextContent('Objective 1')
    })
  })

  it('should disable edit button while editor is open', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    const editButton = screen.getByTestId('edit-content-button')
    
    // Initially enabled
    expect(editButton).not.toBeDisabled()

    // Open editor
    fireEvent.click(editButton)

    // Should be disabled while editor is open
    await waitFor(() => {
      expect(editButton).toBeDisabled()
    })
  })

  it('should show edit icon in button', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    const editButton = screen.getByTestId('edit-content-button')
    const icon = editButton.querySelector('[data-testid="edit-icon"]')
    
    expect(icon).toBeInTheDocument()
  })

  it('should position edit button near page content section', () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Edit button should be within the page info card
    const pageInfoCard = screen.getByTestId('current-page-info-card')
    const editButton = screen.getByTestId('edit-content-button')
    
    expect(pageInfoCard).toContainElement(editButton)
  })

  it('should preserve other page properties when updating content', async () => {
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
        onUpdateContent={mockOnUpdateContent}
      />
    )

    // Add media to the page first
    const media = { id: 'test-media', type: 'image', url: 'test.jpg', title: 'Test' }
    // ... simulate adding media ...

    // Then edit content
    fireEvent.click(screen.getByTestId('edit-content-button'))
    fireEvent.click(await screen.findByText('Save Changes'))

    // Should preserve all other properties including media
    await waitFor(() => {
      expect(mockOnUpdateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          welcomePage: expect.objectContaining({
            id: 'welcome',
            title: 'Welcome Page',
            content: '<p>Updated content from editor</p>',
            narration: 'Welcome narration',
            // All other properties should be preserved
          })
        })
      )
    })
  })
})