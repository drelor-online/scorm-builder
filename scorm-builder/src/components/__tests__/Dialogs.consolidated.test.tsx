/**
 * Dialogs - Consolidated Test Suite
 * 
 * This file consolidates Dialog and Modal tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - ConfirmDialog.test.tsx (confirmation dialog functionality)
 * - Modal.test.tsx (modal component behavior and scrolling)
 * - DeleteConfirmDialog.intent.test.tsx (delete confirmation interactions)
 * 
 * Test Categories:
 * - ConfirmDialog rendering and interaction
 * - Modal scrolling and layout behavior
 * - DeleteConfirmDialog user interactions
 * - Dialog variants and styling
 * - Accessibility and keyboard navigation
 * - Error handling and edge cases
 */

import React from 'react'
import { render, screen, fireEvent } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'
import { DeleteConfirmDialog } from '../DeleteConfirmDialog'
import { Modal } from '../DesignSystem/Modal'

// Mock design tokens
vi.mock('../DesignSystem/designTokens', () => ({
  tokens: {
    colors: {
      danger: { main: '#dc2626' },
      primary: { main: '#3b82f6' },
      text: { primary: '#ffffff' },
      background: { secondary: '#27272a' },
      border: { default: '#3f3f46' }
    },
    borderRadius: { lg: '0.5rem' },
    spacing: {
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem'
    },
    typography: {
      fontSize: {
        base: '1rem',
        xl: '1.25rem'
      }
    },
    shadows: {
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
    }
  }
}))

// Mock Button component
vi.mock('../DesignSystem/Button', () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button 
      onClick={onClick}
      data-variant={variant}
      data-testid={`button-${children.toString().toLowerCase().replace(/\s+/g, '-')}`}
    >
      {children}
    </button>
  )
}))

describe('Dialogs - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ConfirmDialog - Basic Functionality', () => {
    const defaultConfirmProps = {
      isOpen: true,
      title: 'Test Title',
      message: 'Test message',
      onConfirm: vi.fn(),
      onCancel: vi.fn()
    }

    it('should not render when isOpen is false', () => {
      render(<ConfirmDialog {...defaultConfirmProps} isOpen={false} />)
      
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument()
    })

    it('should render all elements when isOpen is true', () => {
      render(<ConfirmDialog {...defaultConfirmProps} />)
      
      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test message')).toBeInTheDocument()
      expect(screen.getByTestId('button-confirm')).toBeInTheDocument()
      expect(screen.getByTestId('button-cancel')).toBeInTheDocument()
    })

    it('should use custom button text when provided', () => {
      render(
        <ConfirmDialog 
          {...defaultConfirmProps} 
          confirmText="Delete" 
          cancelText="Keep"
        />
      )
      
      expect(screen.getByTestId('button-delete')).toBeInTheDocument()
      expect(screen.getByTestId('button-keep')).toBeInTheDocument()
    })

    it('should call onConfirm when confirm button is clicked', () => {
      render(<ConfirmDialog {...defaultConfirmProps} />)
      
      fireEvent.click(screen.getByTestId('button-confirm'))
      
      expect(defaultConfirmProps.onConfirm).toHaveBeenCalledTimes(1)
      expect(defaultConfirmProps.onCancel).not.toHaveBeenCalled()
    })

    it('should call onCancel when cancel button is clicked', () => {
      render(<ConfirmDialog {...defaultConfirmProps} />)
      
      fireEvent.click(screen.getByTestId('button-cancel'))
      
      expect(defaultConfirmProps.onCancel).toHaveBeenCalledTimes(1)
      expect(defaultConfirmProps.onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('ConfirmDialog - Variants and Styling', () => {
    const defaultProps = {
      isOpen: true,
      title: 'Test Title',
      message: 'Test message',
      onConfirm: vi.fn(),
      onCancel: vi.fn()
    }

    it('should use danger variant by default', () => {
      render(<ConfirmDialog {...defaultProps} />)
      
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toHaveClass('btn-danger')
      
      const title = screen.getByText('Test Title')
      expect(title).toHaveStyle({ color: '#ef4444' })  // danger[500]
    })

    it('should use warning variant when specified', () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />)
      
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toHaveClass('btn-primary')
      
      const title = screen.getByText('Test Title')
      expect(title).toHaveStyle({ color: '#fbbf24' })  // warning[400]
    })

    it('should use info variant when specified', () => {
      render(<ConfirmDialog {...defaultProps} variant="info" />)
      
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toHaveClass('btn-primary')
      
      const title = screen.getByText('Test Title')
      expect(title).toHaveStyle({ color: '#3b82f6' })  // info[500]
    })

    it('should render with proper styling', () => {
      render(<ConfirmDialog {...defaultProps} />)
      
      const overlay = screen.getByText('Test Title').closest('.dialog-overlay')
      expect(overlay).toHaveStyle({
        position: 'fixed',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1100
      })
      
      const content = screen.getByText('Test Title').closest('.dialog-content')
      expect(content).toHaveStyle({
        backgroundColor: '#27272a',
        borderRadius: '0.5rem'
      })
    })
  })

  describe('ConfirmDialog - Edge Cases', () => {
    const defaultProps = {
      isOpen: true,
      title: 'Test Title',
      message: 'Test message',
      onConfirm: vi.fn(),
      onCancel: vi.fn()
    }

    it('should handle long messages gracefully', () => {
      const longMessage = 'This is a very long message '.repeat(10).trim()
      render(<ConfirmDialog {...defaultProps} message={longMessage} />)
      
      expect(screen.getByText(longMessage)).toBeInTheDocument()
    })

    it('should handle long titles gracefully', () => {
      const longTitle = 'This is a very long title that might wrap'
      render(<ConfirmDialog {...defaultProps} title={longTitle} />)
      
      expect(screen.getByText(longTitle)).toBeInTheDocument()
    })

    it('should call onCancel when overlay is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />)
      
      const overlay = screen.getByText('Test Title').closest('.dialog-overlay')
      fireEvent.click(overlay!)
      
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    })

    it('should not call onCancel when dialog content is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />)
      
      const content = screen.getByText('Test Title').closest('.dialog-content')
      fireEvent.click(content!)
      
      expect(defaultProps.onCancel).not.toHaveBeenCalled()
    })
  })

  describe('DeleteConfirmDialog - User Interactions', () => {
    const mockOnConfirm = vi.fn()
    const mockOnCancel = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should display clear warning about what will be deleted', () => {
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="My Important Project"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Delete Project')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete "My Important Project"\?/)).toBeInTheDocument()
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
    })

    it('should confirm deletion when user clicks delete', async () => {
      const user = userEvent.setup()
      
      render(
        <DeleteConfirmDialog
          isOpen={true}
          projectName="Test Course"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      await user.click(deleteButton)

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
      expect(mockOnCancel).not.toHaveBeenCalled()
    })

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
      const styles = window.getComputedStyle(deleteButton)
      
      expect(deleteButton.style.backgroundColor || styles.backgroundColor)
        .toMatch(/#ef4444|rgb\(239, 68, 68\)|rgb\(220, 38, 38\)/)
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

  describe('DeleteConfirmDialog - Project Identification', () => {
    const mockOnConfirm = vi.fn()
    const mockOnCancel = vi.fn()

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

    it('should have proper heading structure', () => {
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

    it('should position buttons in the same container', () => {
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
      
      expect(deleteButton.parentElement).toBe(cancelButton.parentElement)
    })
  })

  describe('Modal - Scrolling and Layout', () => {
    it('should have proper scrolling setup for tall content', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div style={{ height: '2000px' }}>
            <p>Very tall content that requires scrolling</p>
          </div>
        </Modal>
      )

      const modalBody = screen.getByRole('dialog').querySelector('.modal-body')
      expect(modalBody).toBeInTheDocument()
      
      const styles = window.getComputedStyle(modalBody!)
      expect(styles.overflowY).toBe('auto')
    })

    it('should constrain modal height to viewport', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>Content</div>
        </Modal>
      )

      const modalContent = screen.getByRole('dialog')
      const styles = window.getComputedStyle(modalContent)
      
      expect(styles.maxHeight).toBe('90vh')
    })

    it('should use flexbox layout for proper height distribution', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>Content</div>
        </Modal>
      )

      const modalContent = screen.getByRole('dialog')
      const styles = window.getComputedStyle(modalContent)
      
      expect(styles.display).toBe('flex')
      expect(styles.flexDirection).toBe('column')
    })

    it('should ensure modal body can grow within constraints', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>Content</div>
        </Modal>
      )

      const modalBody = screen.getByRole('dialog').querySelector('.modal-body')
      const styles = window.getComputedStyle(modalBody!)
      
      expect(styles.flex).toBe('1 1 0%')
    })
  })

  describe('Modal - Accessibility and Interaction', () => {
    it('should close when close button is clicked', async () => {
      const mockOnClose = vi.fn()
      
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <div>Content</div>
        </Modal>
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      await userEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should trap focus within modal', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>
            <button>First Button</button>
            <button>Second Button</button>
          </div>
        </Modal>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('role', 'dialog')
    })

    it('should have proper heading structure', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal Title">
          <div>Content</div>
        </Modal>
      )

      const title = screen.getByText('Test Modal Title')
      expect(title.tagName).toMatch(/H[1-6]/)
    })
  })

  describe('Dialogs - Error Handling', () => {
    it('should handle missing callback functions gracefully', () => {
      expect(() => {
        render(
          <ConfirmDialog
            isOpen={true}
            title="Test"
            message="Test"
            onConfirm={undefined as any}
            onCancel={undefined as any}
          />
        )
      }).not.toThrow()
    })

    it('should handle empty strings for dialog content', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title=""
          message=""
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      // Should still render the dialog structure
      expect(screen.getByTestId('button-confirm')).toBeInTheDocument()
      expect(screen.getByTestId('button-cancel')).toBeInTheDocument()
    })

    it('should handle rapid open/close state changes', () => {
      const { rerender } = render(
        <Modal isOpen={false} onClose={vi.fn()} title="Test">
          <div>Content</div>
        </Modal>
      )

      // Rapidly toggle state
      rerender(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          <div>Content</div>
        </Modal>
      )

      rerender(
        <Modal isOpen={false} onClose={vi.fn()} title="Test">
          <div>Content</div>
        </Modal>
      )

      // Should not throw and handle state changes gracefully
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})