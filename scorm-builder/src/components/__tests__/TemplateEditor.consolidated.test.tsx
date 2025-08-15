/**
 * TemplateEditor - Consolidated Test Suite
 * 
 * This file consolidates TemplateEditor tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - TemplateEditor.intent.test.tsx (user interaction and business logic)
 * - TemplateEditorScrolling.test.tsx (scrolling behavior and layout)
 * 
 * Test Categories:
 * - Template management (create, edit, delete)
 * - Prompt section editing and tag insertion
 * - Template preview functionality
 * - Scrolling and layout behavior
 * - LocalStorage persistence
 * - User interaction flows
 * - Validation and error handling
 */

import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateEditor } from '../TemplateEditor'
import { Modal } from '../DesignSystem/Modal'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

describe('TemplateEditor - Consolidated Test Suite', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('Template Management - Basic Functionality', () => {
    it('should display template management interface', () => {
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Template Editor')).toBeInTheDocument()
      expect(screen.getByText('Add New Template')).toBeInTheDocument()
      expect(screen.getByText('Custom Templates')).toBeInTheDocument()
    })

    it('should show empty state when no templates exist', () => {
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('No custom templates yet')).toBeInTheDocument()
      expect(screen.getByText('Create Your First Template')).toBeInTheDocument()
    })

    it('should transition to create mode when clicking Add New Template', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const createButton = screen.getByText('Add New Template')
      await user.click(createButton)

      expect(screen.getByText('Create New Template')).toBeInTheDocument()
      expect(screen.getByText('Template Name')).toBeInTheDocument()
      expect(screen.getByText('Topics')).toBeInTheDocument()
      expect(screen.getByText('Prompt Builder')).toBeInTheDocument()
    })
  })

  describe('Template Creation and Editing', () => {
    it('should allow creating a new template with all required fields', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Navigate to create mode
      await user.click(screen.getByText('Add New Template'))

      // Fill in template name
      const nameInput = screen.getByPlaceholderText('e.g., Safety Training')
      await user.type(nameInput, 'My Custom Template')

      // Add topics
      const topicsInput = screen.getByPlaceholderText(/Topic 1/)
      await user.type(topicsInput, 'Topic 1\nTopic 2\nTopic 3')

      // Save template
      const saveButton = screen.getByText('Save Template')
      await user.click(saveButton)

      // Verify localStorage save was called
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
      expect(mockOnSave).toHaveBeenCalled()
    })

    it('should load and allow editing existing templates', async () => {
      const user = userEvent.setup()
      
      // Mock existing template in localStorage
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
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'custom-templates') {
          return JSON.stringify(existingTemplates)
        }
        return null
      })
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Should display the existing template
      expect(screen.getByText('Test Template')).toBeInTheDocument()
      expect(screen.getByText('2 topics')).toBeInTheDocument()

      // Click edit button
      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      // Verify existing content is loaded
      expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument()
      const topicsTextarea = screen.getByPlaceholderText(/Topic 1/)
      expect(topicsTextarea).toHaveValue('Existing Topic 1\nExisting Topic 2')
    })

    it('should validate required fields before saving', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))

      // Try to save without required fields
      const saveButton = screen.getByText('Save Template')
      await user.click(saveButton)

      // Should show validation errors
      expect(screen.getByText('Template name is required')).toBeInTheDocument()
    })

    it('should prevent duplicate template names', async () => {
      const user = userEvent.setup()
      
      // Mock existing template
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'custom-templates') {
          return JSON.stringify({
            'Existing Template': {
              topics: ['Topic 1'],
              promptSections: { introduction: '', structure: '', topics: '', output: '' }
            }
          })
        }
        return null
      })
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))
      
      const nameInput = screen.getByPlaceholderText('e.g., Safety Training')
      await user.type(nameInput, 'Existing Template')
      
      const topicsInput = screen.getByPlaceholderText(/Topic 1/)
      await user.type(topicsInput, 'New Topic')

      await user.click(screen.getByText('Save Template'))

      expect(screen.getByText('Template name already exists')).toBeInTheDocument()
    })
  })

  describe('Template Deletion', () => {
    it('should allow deleting templates with confirmation', async () => {
      const user = userEvent.setup()
      
      // Mock existing template
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'custom-templates') {
          return JSON.stringify({
            'Template to Delete': {
              topics: ['Topic 1'],
              promptSections: { introduction: '', structure: '', topics: '', output: '' }
            }
          })
        }
        return null
      })
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Template to Delete')).toBeInTheDocument()

      // Click delete button
      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      // Should show confirmation dialog
      expect(screen.getByText('Delete Template')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete "Template to Delete"\?/)).toBeInTheDocument()

      // Confirm deletion
      const confirmButton = screen.getByText('Confirm Delete')
      await user.click(confirmButton)

      // Should update localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should cancel deletion when user cancels confirmation', async () => {
      const user = userEvent.setup()
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'custom-templates') {
          return JSON.stringify({
            'Important Template': {
              topics: ['Topic 1'],
              promptSections: { introduction: '', structure: '', topics: '', output: '' }
            }
          })
        }
        return null
      })
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      // Cancel deletion
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      // Template should still exist
      expect(screen.getByText('Important Template')).toBeInTheDocument()
    })
  })

  describe('Prompt Section Editing and Tags', () => {
    it('should display available tags with descriptions', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))

      expect(screen.getByText('Available Tags')).toBeInTheDocument()
      expect(screen.getByText('Insert {{courseTitle}}')).toBeInTheDocument()
      expect(screen.getByText('Insert {{difficulty}}')).toBeInTheDocument()
      expect(screen.getByText('Insert {{topics}}')).toBeInTheDocument()
      expect(screen.getByText('Insert {{topicCount}}')).toBeInTheDocument()

      // Should show tag descriptions
      expect(screen.getByText(/The name of the course/)).toBeInTheDocument()
      expect(screen.getByText(/The difficulty level/)).toBeInTheDocument()
    })

    it('should insert tags when clicked', async () => {
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

    it('should allow editing all prompt sections', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))

      // Edit introduction section
      const introTextarea = document.getElementById('prompt-introduction') as HTMLTextAreaElement
      await user.clear(introTextarea)
      await user.paste('Create a {{difficulty}} course about {{courseTitle}}')

      // Should have all prompt sections
      expect(document.getElementById('prompt-introduction')).toBeInTheDocument()
      expect(document.getElementById('prompt-structure')).toBeInTheDocument()
      expect(document.getElementById('prompt-topics')).toBeInTheDocument()
      expect(document.getElementById('prompt-output')).toBeInTheDocument()
    })
  })

  describe('Template Preview', () => {
    it('should show preview with sample data substitution', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))

      // Should show preview section
      expect(screen.getByText('Preview')).toBeInTheDocument()
      
      // Preview should show sample data replacements
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

      // Edit introduction section
      const introTextarea = document.getElementById('prompt-introduction') as HTMLTextAreaElement
      await user.clear(introTextarea)
      await user.paste('This is a {{difficulty}} level course')

      // Preview should update with replaced values
      await waitFor(() => {
        const previewSection = screen.getByText('Preview').parentElement
        const previewContent = previewSection?.querySelector('div[style*="background-color: rgb(9, 9, 11)"]')
        expect(previewContent).toHaveTextContent('This is a Medium level course')
      })
    })
  })

  describe('Scrolling and Layout Behavior', () => {
    it('should render properly within a scrollable modal', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Template Editor"
          size="large"
        >
          <TemplateEditor
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </Modal>
      )
      
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      
      const modalBody = modal.querySelector('.modal-body')
      expect(modalBody).toBeInTheDocument()
      
      if (modalBody) {
        const styles = window.getComputedStyle(modalBody)
        expect(styles.overflowY).toBe('auto')
      }
    })

    it('should have proper max-height constraints in modal', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Template Editor"
          size="large"
        >
          <TemplateEditor
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </Modal>
      )
      
      const modalContent = document.querySelector('.modal-content')
      expect(modalContent).toBeInTheDocument()
      
      if (modalContent) {
        const styles = window.getComputedStyle(modalContent)
        expect(styles.maxHeight).toBe('90vh')
        expect(styles.display).toBe('flex')
        expect(styles.flexDirection).toBe('column')
      }
    })

    it('should maintain proper scrolling structure', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Template Editor"
          size="large"
        >
          <TemplateEditor
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </Modal>
      )
      
      const modalBody = document.querySelector('.modal-body')
      expect(modalBody).toBeInTheDocument()
      
      if (modalBody) {
        const bodyElement = modalBody as HTMLElement
        expect(bodyElement.style.flex).toContain('1')
        expect(bodyElement.style.overflowY).toBe('auto')
        expect(bodyElement.style.overflowX).toBe('hidden')
        expect(bodyElement.style.minHeight).toBe('0')
        expect(bodyElement.style.maxHeight).toBe('100%')
      }
    })

    it('should maintain content visibility when scrolling', () => {
      const { container } = render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )
      
      const scrollableArea = container.querySelector('div[style*="overflow: auto"]')
      expect(scrollableArea).toBeInTheDocument()
      
      const contentSection = screen.getByText('Custom Templates').closest('section')
      expect(contentSection).toBeInTheDocument()
      
      const scrollParent = contentSection?.parentElement
      expect(scrollParent).toHaveStyle({ overflow: 'auto' })
    })
  })

  describe('Navigation and User Flow', () => {
    it('should navigate between list and create modes', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      // Start in list mode
      expect(screen.getByText('Custom Templates')).toBeInTheDocument()

      // Go to create mode
      await user.click(screen.getByText('Add New Template'))
      expect(screen.getByText('Create New Template')).toBeInTheDocument()

      // Return to list mode
      const cancelButtons = screen.getAllByText('Cancel')
      await user.click(cancelButtons[0])
      expect(screen.getByText('Custom Templates')).toBeInTheDocument()
    })

    it('should call onSave callback after successfully saving template', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))
      await user.type(screen.getByPlaceholderText('e.g., Safety Training'), 'Test Save')
      await user.type(screen.getByPlaceholderText(/Topic 1/), 'Topic 1')
      await user.click(screen.getByText('Save Template'))

      expect(mockOnSave).toHaveBeenCalled()
    })

    it('should return to list view after saving template', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))
      await user.type(screen.getByPlaceholderText('e.g., Safety Training'), 'New Template')
      await user.type(screen.getByPlaceholderText(/Topic 1/), 'Topic 1')
      await user.click(screen.getByText('Save Template'))

      // Should return to list view
      await waitFor(() => {
        expect(screen.getByText('Custom Templates')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      expect(() => {
        render(
          <TemplateEditor
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        )
      }).not.toThrow()
    })

    it('should handle malformed localStorage data', () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'custom-templates') {
          return 'invalid json'
        }
        return null
      })

      expect(() => {
        render(
          <TemplateEditor
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        )
      }).not.toThrow()

      // Should show empty state
      expect(screen.getByText('No custom templates yet')).toBeInTheDocument()
    })

    it('should handle missing prompt sections in loaded templates', async () => {
      const user = userEvent.setup()
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'custom-templates') {
          return JSON.stringify({
            'Incomplete Template': {
              topics: ['Topic 1']
              // Missing promptSections
            }
          })
        }
        return null
      })
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      // Should handle missing promptSections gracefully
      expect(document.getElementById('prompt-introduction')).toBeInTheDocument()
      expect(document.getElementById('prompt-structure')).toBeInTheDocument()
    })

    it('should validate topics are not empty', async () => {
      const user = userEvent.setup()
      
      render(
        <TemplateEditor
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      await user.click(screen.getByText('Add New Template'))
      await user.type(screen.getByPlaceholderText('e.g., Safety Training'), 'Test Template')
      
      // Try to save without topics
      await user.click(screen.getByText('Save Template'))

      expect(screen.getByText('At least one topic is required')).toBeInTheDocument()
    })
  })
})