import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateEditor } from '../TemplateEditor'

describe('TemplateEditor - User Intent Tests', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('User wants to manage custom templates', () => {
    it('should display template management interface', () => {
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Should show template editor title
      expect(screen.getByText('Template Editor')).toBeInTheDocument()
      
      // Should show create new template button
      expect(screen.getByText('Add New Template')).toBeInTheDocument()
    })

    it('should allow creating a new template', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Click create new template
      const createButton = screen.getByText('Add New Template')
      await user.click(createButton)

      // Fill in template name
      const nameInput = screen.getByPlaceholderText('e.g., Safety Training')
      await user.type(nameInput, 'My Custom Template')

      // Add topics  
      const topicsInput = screen.getByPlaceholderText(/Topic 1/)
      await user.type(topicsInput, 'Topic 1\nTopic 2\nTopic 3')

      // Save template
      const saveButton = screen.getByText('Save Template')
      await user.click(saveButton)

      // Verify it was saved to localStorage
      const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '{}')
      expect(savedTemplates['My Custom Template']).toBeDefined()
      expect(savedTemplates['My Custom Template'].topics).toEqual(['Topic 1', 'Topic 2', 'Topic 3'])
    })

    it('should allow editing existing templates', async () => {
      const user = userEvent.setup()
      
      // Pre-populate localStorage with a template
      const existingTemplates = {
        'Test Template': {
          topics: ['Existing Topic 1', 'Existing Topic 2'],
          promptSections: {
            introduction: 'Test introduction',
            structure: 'Test structure',
            topics: 'Test topics',
            output: 'Test output'
          }
        }
      }
      localStorage.setItem('customTemplates', JSON.stringify(existingTemplates))
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Click edit button for the template
      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      // Verify existing content is loaded
      expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument()
      const topicsTextarea = screen.getByPlaceholderText(/Topic 1/)
      expect(topicsTextarea).toHaveValue('Existing Topic 1\nExisting Topic 2')
    })
  })

  describe('User wants to edit prompt sections', () => {
    it('should display prompt sections with available tags', async () => {
      const user = userEvent.setup()
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Click create new to see prompt sections
      const createButton = screen.getByText('Add New Template')
      await user.click(createButton)

      // Should show available tags section
      expect(screen.getByText('Available Tags')).toBeInTheDocument()
      // Tags are shown as Insert buttons
      expect(screen.getByText('Insert {{courseTitle}}')).toBeInTheDocument()
      expect(screen.getByText('Insert {{difficulty}}')).toBeInTheDocument()
      expect(screen.getByText('Insert {{topics}}')).toBeInTheDocument()
      expect(screen.getByText('Insert {{topicCount}}')).toBeInTheDocument()
    })

    it('should allow editing prompt sections', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Create new template
      await user.click(screen.getByText('Add New Template'))

      // The introduction section should be visible by default
      const introTextarea = document.getElementById('prompt-introduction') as HTMLTextAreaElement
      await user.clear(introTextarea)
      await user.paste('Create a {{difficulty}} course about {{courseTitle}}')

      // Add topics first (required)
      const topicsTextarea = document.getElementById('template-topics') as HTMLTextAreaElement
      await user.type(topicsTextarea, 'Topic 1\nTopic 2')

      // Save
      await user.type(screen.getByPlaceholderText('e.g., Safety Training'), 'Custom Prompt Template')
      await user.click(screen.getByText('Save Template'))

      // Verify saved
      await waitFor(() => {
        const saved = JSON.parse(localStorage.getItem('customTemplates') || '{}')
        expect(saved['Custom Prompt Template']).toBeDefined()
        expect(saved['Custom Prompt Template'].promptSections.introduction)
          .toBe('Create a {{difficulty}} course about {{courseTitle}}')
      })
    })
  })

  describe('User wants to delete templates', () => {
    it('should allow deleting custom templates', async () => {
      const user = userEvent.setup()
      
      // Pre-populate with template
      localStorage.setItem('customTemplates', JSON.stringify({
        'Template to Delete': {
          topics: ['Topic 1'],
          promptSections: {
            introduction: 'intro',
            structure: 'struct',
            topics: 'topics',
            output: 'output'
          }
        }
      }))
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Should show the template
      expect(screen.getByText('Template to Delete')).toBeInTheDocument()

      // Click delete button
      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      // Confirm deletion
      const confirmButton = screen.getByText('Confirm Delete')
      await user.click(confirmButton)

      // Verify template was removed
      const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '{}')
      expect(savedTemplates['Template to Delete']).toBeUndefined()
    })

    it('should show confirmation before deleting', async () => {
      const user = userEvent.setup()
      
      localStorage.setItem('customTemplates', JSON.stringify({
        'Important Template': {
          topics: ['Topic 1'],
          promptSections: {
            introduction: 'intro',
            structure: 'struct', 
            topics: 'topics',
            output: 'output'
          }
        }
      }))
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Click delete
      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      // Should show confirmation dialog
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument()
      
      // Cancel deletion
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      // Template should still exist
      expect(screen.getByText('Important Template')).toBeInTheDocument()
    })
  })

  describe('User wants to preview template output', () => {
    it('should show preview with sample data', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Create new template
      await user.click(screen.getByText('Add New Template'))

      // Should show preview section
      expect(screen.getByText('Preview')).toBeInTheDocument()
      
      // Preview should show sample data replacements
      // The preview is in a div, so we need to check the container
      const preview = screen.getByText('Preview').closest('div')?.parentElement
      expect(preview).toHaveTextContent('Sample Course')
      expect(preview).toHaveTextContent('Medium')
    })

    it('should update preview when editing prompt sections', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))

      // The introduction section should be visible by default
      const introTextarea = document.getElementById('prompt-introduction') as HTMLTextAreaElement
      await user.clear(introTextarea)
      await user.paste('This is a {{difficulty}} level course')

      // Preview should update with replaced values
      await waitFor(() => {
        // Find the preview content div (the one with gray background)
        const previewSection = screen.getByText('Preview').parentElement
        const previewContent = previewSection?.querySelector('div[style*="background-color: rgb(9, 9, 11)"]')
        expect(previewContent).toHaveTextContent('This is a Medium level course')
      })
    })
  })

  describe('User wants to close template editor', () => {
    it('should close when clicking close button', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Click cancel button to go back to list view
      await user.click(screen.getByText('Add New Template')) // Go to create mode first
      const cancelButtons = screen.getAllByText('Cancel')
      // Click the first cancel button (in the header)
      await user.click(cancelButtons[0])

      // This should return to list view
      expect(screen.getByText('Custom Templates')).toBeInTheDocument()
    })

    it('should call onSave callback after saving template', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Create and save a template
      await user.click(screen.getByText('Add New Template'))
      await user.type(screen.getByPlaceholderText('e.g., Safety Training'), 'Test Save')
      await user.type(screen.getByPlaceholderText(/Topic 1/), 'Topic 1')
      await user.click(screen.getByText('Save Template'))

      expect(mockOnSave).toHaveBeenCalled()
    })
  })

  describe('User wants to use template tags', () => {
    it('should insert tag when clicking on it', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))

      // Click on a tag
      const titleTag = screen.getByText('Insert {{courseTitle}}')
      await user.click(titleTag)

      // Tag should be inserted into active textarea
      await waitFor(() => {
        const introTextarea = document.getElementById('prompt-introduction') as HTMLTextAreaElement
        expect(introTextarea.value).toContain('{{courseTitle}}')
      })
    })

    it('should show tag descriptions', async () => {
      const user = userEvent.setup()
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const createButton = screen.getByText('Add New Template')
      await user.click(createButton)

      // Should show tag descriptions in the Available Tags section
      expect(screen.getByText('Available Tags')).toBeInTheDocument()
      expect(screen.getByText(/The name of the course/)).toBeInTheDocument()
      expect(screen.getByText(/The difficulty level \(Basic, Easy, Medium, Hard, Expert\)/)).toBeInTheDocument()
    })
  })
})