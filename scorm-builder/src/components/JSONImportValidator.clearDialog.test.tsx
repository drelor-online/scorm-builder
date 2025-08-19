import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('JSONImportValidator Clear Dialog', () => {
  const mockProps = {
    isOpen: true,
    title: "Clear Course Structure",
    confirmText: "Clear Course Structure",
    cancelText: "Keep Current Structure",
    variant: "warning" as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  }

  it('should display the comprehensive warning message', () => {
    const message = (
      <>
        <strong>Warning:</strong> This will remove the current course structure and <strong>all content</strong> from the following pages:
        <ul style={{ margin: '0.75rem 0', paddingLeft: '1.5rem' }}>
          <li>Media Enhancement</li>
          <li>Audio Narration</li>
          <li>Activities Editor</li>
          <li>SCORM Package Builder</li>
        </ul>
        These pages will be <strong>locked</strong> until you import new JSON data.
        <br /><br />
        <strong>Alternative:</strong> If you just want to edit course content, you can make changes on the individual pages above instead of clearing the JSON structure.
        <br /><br />
        Are you sure you want to clear the course structure?
      </>
    )

    render(
      <ConfirmDialog
        {...mockProps}
        message={message}
      />
    )

    // Verify all the important warning elements are present
    expect(screen.getByText('Warning:', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/all content/)).toBeInTheDocument()
    expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
    expect(screen.getByText('Audio Narration')).toBeInTheDocument()
    expect(screen.getByText('Activities Editor')).toBeInTheDocument()
    expect(screen.getByText('SCORM Package Builder')).toBeInTheDocument()
    expect(screen.getByText(/locked/)).toBeInTheDocument()
    expect(screen.getByText('Alternative:', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to clear the course structure/)).toBeInTheDocument()
  })

  it('should have clear action and cancel buttons with correct text', () => {
    render(
      <ConfirmDialog
        {...mockProps}
        message="Test message"
      />
    )

    expect(screen.getByTestId('button-confirm')).toHaveTextContent('Clear Course Structure')
    expect(screen.getByText('Keep Current Structure')).toBeInTheDocument()
  })

  it('should call onConfirm when clear button is clicked', () => {
    render(
      <ConfirmDialog
        {...mockProps}
        message="Test message"
      />
    )

    const clearButton = screen.getByTestId('button-confirm')
    fireEvent.click(clearButton)

    expect(mockProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when keep button is clicked', () => {
    render(
      <ConfirmDialog
        {...mockProps}
        message="Test message"
      />
    )

    const keepButton = screen.getByText('Keep Current Structure')
    fireEvent.click(keepButton)

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1)
  })
})