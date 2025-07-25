import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnsavedChangesDialog } from '../UnsavedChangesDialog'

describe('UnsavedChangesDialog - User Intent Tests', () => {
  const mockOnSave = vi.fn()
  const mockOnDiscard = vi.fn()
  const mockOnCancel = vi.fn()
  
  const defaultProps = {
    isOpen: true,
    currentProjectName: 'Test Project',
    onSave: mockOnSave,
    onDiscard: mockOnDiscard,
    onCancel: mockOnCancel
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User wants to save changes before continuing', () => {
    it('should clearly explain the situation to the user', () => {
      render(<UnsavedChangesDialog {...defaultProps} />)

      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument()
      expect(screen.getByText('You have unsaved changes in "Test Project".')).toBeInTheDocument()
      expect(screen.getByText('Would you like to save before opening a new project?')).toBeInTheDocument()
    })

    it('should save and continue when user chooses save', async () => {
      const user = userEvent.setup()
      
      render(<UnsavedChangesDialog {...defaultProps} />)

      const saveButton = screen.getByText('Save & Continue')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalledTimes(1)
      expect(mockOnDiscard).not.toHaveBeenCalled()
      expect(mockOnCancel).not.toHaveBeenCalled()
    })
  })

  describe('User wants to discard changes', () => {
    it('should warn about data loss when discarding', () => {
      render(<UnsavedChangesDialog {...defaultProps} />)

      const discardButton = screen.getByText('Discard Changes')
      
      // Should have danger styling (red border)
      expect(discardButton).toHaveStyle({ border: '1px solid #ef4444' })
    })

    it('should discard and continue when user confirms', async () => {
      const user = userEvent.setup()
      
      render(<UnsavedChangesDialog {...defaultProps} />)

      const discardButton = screen.getByText('Discard Changes')
      await user.click(discardButton)

      expect(mockOnDiscard).toHaveBeenCalledTimes(1)
      expect(mockOnSave).not.toHaveBeenCalled()
      expect(mockOnCancel).not.toHaveBeenCalled()
    })
  })

  describe('User wants to stay and continue editing', () => {
    it('should cancel and stay when user clicks cancel', async () => {
      const user = userEvent.setup()
      
      render(<UnsavedChangesDialog {...defaultProps} />)

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
      expect(mockOnSave).not.toHaveBeenCalled()
      expect(mockOnDiscard).not.toHaveBeenCalled()
    })
  })

  describe('User wants visual hierarchy', () => {
    it('should not render when closed', () => {
      render(
        <UnsavedChangesDialog
          {...defaultProps}
          isOpen={false}
        />
      )

      expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument()
    })
  })

  describe('Dialog appearance and layout', () => {
    it('should display with proper styling', () => {
      render(<UnsavedChangesDialog {...defaultProps} />)
      
      // Check header exists with warning color
      const header = screen.getByText('Unsaved Changes')
      expect(header).toHaveStyle({ color: '#fbbf24' })
    })

    it('should show buttons in correct order', () => {
      render(<UnsavedChangesDialog {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      expect(buttons[0]).toHaveTextContent('Cancel')
      expect(buttons[1]).toHaveTextContent('Discard Changes')
      expect(buttons[2]).toHaveTextContent('Save & Continue')
    })
  })

  describe('User interaction with different project names', () => {
    it('should display the correct project name', () => {
      render(
        <UnsavedChangesDialog
          {...defaultProps}
          currentProjectName="My Amazing Course"
        />
      )

      expect(screen.getByText('You have unsaved changes in "My Amazing Course".')).toBeInTheDocument()
    })

    it('should handle empty project name gracefully', () => {
      render(
        <UnsavedChangesDialog
          {...defaultProps}
          currentProjectName=""
        />
      )

      expect(screen.getByText('You have unsaved changes in "".')).toBeInTheDocument()
    })
  })
})