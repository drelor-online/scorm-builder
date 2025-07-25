import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '../LoadingSpinner'
import { COLORS } from '../../../constants'

describe('LoadingSpinner Component - Simple Tests', () => {
  it('should render loading spinner', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('status', { name: 'Loading' })
    expect(spinner).toBeInTheDocument()
  })

  it('should render with text when provided', () => {
    render(<LoadingSpinner text="Loading data..." />)
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('should apply size styles', () => {
    const { rerender } = render(<LoadingSpinner size="small" />)
    
    let spinner = screen.getByRole('status')
    expect(spinner.style.width).toBe('1rem')
    expect(spinner.style.height).toBe('1rem')

    rerender(<LoadingSpinner size="medium" />)
    spinner = screen.getByRole('status')
    expect(spinner.style.width).toBe('2rem')
    expect(spinner.style.height).toBe('2rem')

    rerender(<LoadingSpinner size="large" />)
    spinner = screen.getByRole('status')
    expect(spinner.style.width).toBe('3rem')
    expect(spinner.style.height).toBe('3rem')
  })

  it('should apply custom color', () => {
    render(<LoadingSpinner color="#ff0000" />)
    
    const spinner = screen.getByRole('status')
    expect(spinner.style.borderTopColor).toBe('rgb(255, 0, 0)')
  })

  it('should use default color', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('status')
    expect(spinner.style.borderTopColor).toBe('rgb(59, 130, 246)') // COLORS.primary converted to RGB
  })

  it('should render fullscreen overlay when fullScreen is true', () => {
    const { container } = render(<LoadingSpinner fullScreen />)
    
    const overlay = container.firstChild as HTMLElement
    expect(overlay.style.position).toBe('fixed')
    expect(overlay.style.zIndex).toBe('1000')
    expect(overlay.style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)')
  })

  it('should not render overlay when fullScreen is false', () => {
    const { container } = render(<LoadingSpinner fullScreen={false} />)
    
    const spinner = container.firstChild as HTMLElement
    expect(spinner.style.position).not.toBe('fixed')
    expect(spinner.className).toBe('loading-spinner-container')
  })

  it('should apply animation styles', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('status')
    expect(spinner.style.animation).toBe('spin 1s linear infinite')
  })

  it('should apply appropriate text size based on spinner size', () => {
    const { rerender } = render(
      <LoadingSpinner size="small" text="Loading..." />
    )
    
    let text = screen.getByText('Loading...')
    expect(text.style.fontSize).toBe('0.875rem')

    rerender(<LoadingSpinner size="medium" text="Loading..." />)
    text = screen.getByText('Loading...')
    expect(text.style.fontSize).toBe('1rem')

    rerender(<LoadingSpinner size="large" text="Loading..." />)
    text = screen.getByText('Loading...')
    expect(text.style.fontSize).toBe('1rem')
  })

  it('should use default props', () => {
    render(<LoadingSpinner />)
    
    const spinner = screen.getByRole('status')
    expect(spinner.style.width).toBe('2rem') // medium size
    expect(spinner.style.borderTopColor).toBe('rgb(59, 130, 246)') // COLORS.primary converted to RGB
    expect(screen.queryByText(/./)).not.toBeInTheDocument() // no text
  })
})