import { render, screen, fireEvent , waitFor } from '../../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoadingButton } from '../LoadingButton'

// Mock the Button component
vi.mock('../Button', () => ({
  Button: ({ children, onClick, disabled, 'aria-busy': ariaBusy, ...props }: any) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      aria-busy={ariaBusy}
      {...props}
    >
      {children}
    </button>
  )
}))

describe('LoadingButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render children when not loading', () => {
    render(<LoadingButton>Click me</LoadingButton>)
    
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should show default loading text when loading', async () => {
    const asyncClick = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(
      <LoadingButton onClick={asyncClick}>
        Click me
      </LoadingButton>
    )
    
    const button = screen.getByText('Click me')
    fireEvent.click(button)
    
    // Should show loading text
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.queryByText('Click me')).not.toBeInTheDocument()
    
    // Wait for async operation to complete
    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument()
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    })
  })

  it('should show custom loading text when provided', async () => {
    const asyncClick = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(
      <LoadingButton onClick={asyncClick} loadingText="Processing...">
        Submit
      </LoadingButton>
    )
    
    fireEvent.click(screen.getByText('Submit'))
    
    expect(screen.getByText('Processing...')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeInTheDocument()
    })
  })

  it('should disable button while loading', async () => {
    const asyncClick = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(
      <LoadingButton onClick={asyncClick}>
        Click me
      </LoadingButton>
    )
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    
    await waitFor(() => {
      expect(button).not.toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'false')
    })
  })

  it('should not trigger click when already loading', async () => {
    const asyncClick = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(
      <LoadingButton onClick={asyncClick}>
        Click me
      </LoadingButton>
    )
    
    const button = screen.getByRole('button')
    
    // First click
    fireEvent.click(button)
    expect(asyncClick).toHaveBeenCalledTimes(1)
    
    // Second click while loading - should be ignored
    fireEvent.click(button)
    expect(asyncClick).toHaveBeenCalledTimes(1)
    
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it('should handle synchronous onClick', async () => {
    const syncClick = vi.fn()
    
    render(
      <LoadingButton onClick={syncClick}>
        Click me
      </LoadingButton>
    )
    
    fireEvent.click(screen.getByText('Click me'))
    
    expect(syncClick).toHaveBeenCalledTimes(1)
    
    // Wait for state to settle
    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })
  })

  it('should handle errors in onClick', async () => {
    const errorClick = vi.fn(() => Promise.reject(new Error('Test error')))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <LoadingButton onClick={errorClick}>
        Click me
      </LoadingButton>
    )
    
    fireEvent.click(screen.getByText('Click me'))
    
    // Catch the error to prevent unhandled rejection
    await expect(errorClick()).rejects.toThrow('Test error')
    
    await waitFor(() => {
      // Button should return to normal state even after error
      expect(screen.getByText('Click me')).toBeInTheDocument()
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
    
    consoleErrorSpy.mockRestore()
  })

  it('should respect disabled prop', () => {
    const onClick = vi.fn()
    
    render(
      <LoadingButton onClick={onClick} disabled>
        Click me
      </LoadingButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('should forward other props to Button', () => {
    render(
      <LoadingButton 
        className="custom-class"
        data-testid="loading-button"
        aria-label="Custom button"
      >
        Click me
      </LoadingButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
    expect(button).toHaveAttribute('data-testid', 'loading-button')
    expect(button).toHaveAttribute('aria-label', 'Custom button')
  })

  it('should handle undefined onClick', () => {
    render(<LoadingButton>Click me</LoadingButton>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    // Should not throw error
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should maintain loading state during async operation', async () => {
    let resolvePromise: ((value: void) => void) | null = null
    const asyncClick = vi.fn(() => new Promise<void>(resolve => {
      resolvePromise = resolve
    }))
    
    render(
      <LoadingButton onClick={asyncClick}>
        Click me
      </LoadingButton>
    )
    
    fireEvent.click(screen.getByText('Click me'))
    
    // Should be in loading state
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    
    // Resolve the promise
    resolvePromise!()
    
    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument()
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })
})