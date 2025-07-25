import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteConfirmDialog } from '../DeleteConfirmDialog'

describe('DeleteConfirmDialog - User Intent Tests', () => {
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User wants to delete an item', () => {
    it('should display clear warning about what will be deleted', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="My Important Project"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      // User should see what they're about to delete
      expect(screen.getByText('Delete Project')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete "My Important Project"\?/)).toBeInTheDocument()
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
    })

    it('should confirm deletion when user is sure', async () => {
      const user = userEvent.setup()
      
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test Course"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      // User clicks delete button
      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      await user.click(deleteButton)

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
      expect(mockOnCancel).not.toHaveBeenCalled()
    })

    it('should close dialog after confirming deletion', async () => {
      const user = userEvent.setup()
      
      const { rerender } = render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test Item"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      await user.click(deleteButton)

      // Dialog should request to close
      expect(mockOnConfirm).toHaveBeenCalled()
    })
  })

  describe('User wants to cancel deletion', () => {
    it('should cancel when user clicks cancel button', async () => {
      const user = userEvent.setup()
      
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Important Data"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
      expect(mockOnConfirm).not.toHaveBeenCalled()
    })
  })

  describe('User wants visual feedback', () => {
    it('should show delete button with danger styling', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      
      // Check inline styles for danger color
      const styles = window.getComputedStyle(deleteButton)
      expect(deleteButton.style.backgroundColor || styles.backgroundColor).toMatch(/#ef4444|rgb\(239, 68, 68\)|rgb\(220, 38, 38\)/)
    })

    it('should not render when closed', () => {
      const { container } = render(
        <DeleteConfirmDialog
          isOpen={false}
          projectName="Hidden"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('User wants clear project identification', () => {
    it('should display project name in quotes', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Production Database"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/Are you sure you want to delete "Production Database"\?/)).toBeInTheDocument()
    })

    it('should show warning text', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
    })
  })

  describe('User wants proper dialog structure', () => {
    it('should have proper heading', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const heading = screen.getByText('Delete Project')
      expect(heading.tagName).toBe('H2')
    })

    it('should position buttons at the bottom', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      
      // Both buttons should be in the same container
      expect(deleteButton.parentElement).toBe(cancelButton.parentElement)
    })
  })
})