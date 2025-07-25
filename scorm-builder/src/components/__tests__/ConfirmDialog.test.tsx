import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'

// Mock the design tokens
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

// Mock the Button component
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

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Test Title',
    message: 'Test message',
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(<ConfirmDialog {...defaultProps} />)
    
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
    expect(screen.getByTestId('button-confirm')).toBeInTheDocument()
    expect(screen.getByTestId('button-cancel')).toBeInTheDocument()
  })

  it('should use custom button text', () => {
    render(
      <ConfirmDialog 
        {...defaultProps} 
        confirmText="Delete" 
        cancelText="Keep"
      />
    )
    
    expect(screen.getByTestId('button-delete')).toBeInTheDocument()
    expect(screen.getByTestId('button-keep')).toBeInTheDocument()
  })

  it('should call onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    
    fireEvent.click(screen.getByTestId('button-confirm'))
    
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })

  it('should call onCancel when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    
    fireEvent.click(screen.getByTestId('button-cancel'))
    
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    expect(defaultProps.onConfirm).not.toHaveBeenCalled()
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

  describe('variants', () => {
    it('should use danger variant by default', () => {
      render(<ConfirmDialog {...defaultProps} />)
      
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toHaveAttribute('data-variant', 'danger')
      
      // Check title color
      const title = screen.getByText('Test Title')
      expect(title).toHaveStyle({ color: '#dc2626' })
    })

    it('should use warning variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />)
      
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toHaveAttribute('data-variant', 'primary')
      
      // Check title color
      const title = screen.getByText('Test Title')
      expect(title).toHaveStyle({ color: '#fbbf24' })
    })

    it('should use info variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="info" />)
      
      const confirmButton = screen.getByTestId('button-confirm')
      expect(confirmButton).toHaveAttribute('data-variant', 'primary')
      
      // Check title color
      const title = screen.getByText('Test Title')
      expect(title).toHaveStyle({ color: '#3b82f6' })
    })
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

  it('should handle long messages', () => {
    const longMessage = 'This is a very long message '.repeat(10).trim()
    render(<ConfirmDialog {...defaultProps} message={longMessage} />)
    
    expect(screen.getByText(longMessage)).toBeInTheDocument()
  })

  it('should handle long titles', () => {
    const longTitle = 'This is a very long title that might wrap'
    render(<ConfirmDialog {...defaultProps} title={longTitle} />)
    
    expect(screen.getByText(longTitle)).toBeInTheDocument()
  })

  it('should stop propagation on content click', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} />)
    
    const content = container.querySelector('.dialog-content') as HTMLElement
    const clickEvent = new MouseEvent('click', { bubbles: true })
    const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation')
    
    // Dispatch the event
    content.dispatchEvent(clickEvent)
    
    expect(stopPropagationSpy).toHaveBeenCalled()
  })
})