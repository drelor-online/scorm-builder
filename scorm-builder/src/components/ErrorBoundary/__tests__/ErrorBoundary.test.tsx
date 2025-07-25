import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'
import React from 'react'

// Mock console.error to avoid noise in tests
let consoleErrorSpy: any

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

// Component that throws an error
const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should catch errors and display error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/Test error/i)).toBeInTheDocument()
    expect(screen.getByText(/If this problem persists/i)).toBeInTheDocument()
  })

  it('should show try again and reload buttons in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument()
  })

  it('should show technical details in development mode', () => {
    const originalEnv = import.meta.env.MODE
    // @ts-ignore
    import.meta.env.MODE = 'development'

    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Technical details/i)).toBeInTheDocument()
    expect(screen.getByText(/Test error/i)).toBeInTheDocument()

    // @ts-ignore
    import.meta.env.MODE = originalEnv
  })

  it('should log errors with error info', () => {
    const onError = vi.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error'
      }),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('should reset error state when clicking try again', () => {
    let shouldThrow = true
    const ConditionalError = () => {
      if (shouldThrow) {
        throw new Error('Conditional error')
      }
      return <div>Success!</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    
    // Click try again button
    const tryAgainButton = screen.getByRole('button', { name: /Try Again/i })
    
    // Set shouldThrow to false before clicking
    shouldThrow = false
    fireEvent.click(tryAgainButton)
    
    // Force re-render
    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Success!')).toBeInTheDocument()
  })

  it('should reload page when reload button is clicked', () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true
    })

    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    
    const reloadButton = screen.getByRole('button', { name: /Reload Page/i })
    fireEvent.click(reloadButton)
    
    expect(reloadMock).toHaveBeenCalled()
  })

  it('should use custom fallback render when provided', () => {
    const fallbackRender = ({ error, resetError }: any) => (
      <div>
        <p>Custom error: {error.message}</p>
        <button onClick={resetError}>Custom Reset</button>
      </div>
    )
    
    render(
      <ErrorBoundary fallbackRender={fallbackRender}>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom Reset' })).toBeInTheDocument()
  })
})