import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toast } from '../Toast'

describe('Toast Component - Simple Tests', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render with message', () => {
    render(
      <Toast message="Test message" type="info" onClose={mockOnClose} />
    )
    
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('should render close button', () => {
    render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    expect(screen.getByLabelText('Close notification')).toBeInTheDocument()
  })

  it('should call onClose when close button clicked', () => {
    render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    const closeButton = screen.getByLabelText('Close notification')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should auto-close after default duration', () => {
    render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    expect(mockOnClose).not.toHaveBeenCalled()
    
    // Fast forward default duration (3000ms)
    vi.advanceTimersByTime(3000)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should auto-close after custom duration', () => {
    render(
      <Toast message="Test" type="info" onClose={mockOnClose} duration={5000} />
    )
    
    expect(mockOnClose).not.toHaveBeenCalled()
    
    // Advance less than duration
    vi.advanceTimersByTime(4000)
    expect(mockOnClose).not.toHaveBeenCalled()
    
    // Complete the duration
    vi.advanceTimersByTime(1000)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should apply success type styling', () => {
    const { container } = render(
      <Toast message="Success!" type="success" onClose={mockOnClose} />
    )
    
    const toast = container.firstChild as HTMLElement
    expect(toast.style.backgroundColor).toBe('rgb(16, 185, 129)') // #10b981
  })

  it('should apply error type styling', () => {
    const { container } = render(
      <Toast message="Error!" type="error" onClose={mockOnClose} />
    )
    
    const toast = container.firstChild as HTMLElement
    expect(toast.style.backgroundColor).toBe('rgb(239, 68, 68)') // #ef4444
  })

  it('should apply info type styling', () => {
    const { container } = render(
      <Toast message="Info!" type="info" onClose={mockOnClose} />
    )
    
    const toast = container.firstChild as HTMLElement
    expect(toast.style.backgroundColor).toBe('rgb(59, 130, 246)') // #3b82f6
  })

  it('should handle close button hover', () => {
    render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    const closeButton = screen.getByLabelText('Close notification') as HTMLElement
    
    // Initial opacity
    expect(closeButton.style.opacity).toBe('0.8')
    
    // Hover
    fireEvent.mouseEnter(closeButton)
    expect(closeButton.style.opacity).toBe('1')
    
    // Leave
    fireEvent.mouseLeave(closeButton)
    expect(closeButton.style.opacity).toBe('0.8')
  })

  it('should be positioned fixed at bottom right', () => {
    const { container } = render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    const toast = container.firstChild as HTMLElement
    expect(toast.style.position).toBe('fixed')
    expect(toast.style.bottom).toBe('2rem')
    expect(toast.style.right).toBe('2rem')
  })

  it('should have proper z-index', () => {
    const { container } = render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    const toast = container.firstChild as HTMLElement
    expect(toast.style.zIndex).toBe('1000')
  })

  it('should cleanup timer on unmount', () => {
    const { unmount } = render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    unmount()
    
    // Timer should be cleared, so advancing time shouldn't call onClose
    vi.advanceTimersByTime(5000)
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should handle long messages', () => {
    const longMessage = 'This is a very long message that should be displayed properly in the toast component'
    render(
      <Toast message={longMessage} type="info" onClose={mockOnClose} />
    )
    
    expect(screen.getByText(longMessage)).toBeInTheDocument()
  })

  it('should have animation style', () => {
    const { container } = render(
      <Toast message="Test" type="info" onClose={mockOnClose} />
    )
    
    const toast = container.firstChild as HTMLElement
    expect(toast.style.animation).toBe('slideIn 0.3s ease-out')
  })
})