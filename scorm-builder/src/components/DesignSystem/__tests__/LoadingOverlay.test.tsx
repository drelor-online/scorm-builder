// Removed unused React import
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../../test/testProviders'
import { LoadingOverlay } from '../LoadingOverlay'

// Mock LoadingSpinner since it's tested separately
vi.mock('../LoadingSpinner', () => ({
  LoadingSpinner: ({ size }: { size: string }) => (
    <div data-testid="loading-spinner" data-size={size} />
  )
}))

describe('LoadingOverlay', () => {
  beforeEach(() => {
    // Clear any focused elements
    ;(document.activeElement as HTMLElement)?.blur()
  })

  describe('Basic rendering', () => {
    it('should render children when not loading', () => {
      render(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByText('Content')).toBeInTheDocument()
      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument()
    })

    it('should show overlay when loading', () => {
      render(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should render loading spinner with large size', () => {
      render(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('data-size', 'large')
    })

    it('should show default loading message', () => {
      render(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByRole('status')).toHaveTextContent('Loading...')
    })

    it('should show custom loading message', () => {
      render(
        <LoadingOverlay isLoading={true} message="Processing data...">
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByText('Processing data...')).toBeInTheDocument()
    })
  })

  describe('Fade-in animation', () => {
    it('should apply fade-in class when fadeIn is true', () => {
      render(
        <LoadingOverlay isLoading={true} fadeIn={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByTestId('loading-overlay')).toHaveClass('loading-overlay-fade-in')
    })

    it('should not apply fade-in class when fadeIn is false', () => {
      render(
        <LoadingOverlay isLoading={true} fadeIn={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByTestId('loading-overlay')).not.toHaveClass('loading-overlay-fade-in')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on loading message', () => {
      render(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(status).toHaveTextContent('Loading...')
    })

    it('should hide children from screen readers when loading', () => {
      render(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      const contentWrapper = container.querySelector('.loading-overlay-container > div:last-child')
      expect(contentWrapper).toHaveAttribute('aria-hidden', 'true')
    })

    it('should not hide children from screen readers when not loading', () => {
      render(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      const contentWrapper = container.querySelector('.loading-overlay-container > div:last-child')
      expect(contentWrapper).not.toHaveAttribute('aria-hidden')
    })
  })

  describe('Focus trapping', () => {
    it('should not trap focus when trapFocus is false', () => {
      const button = document.createElement('button')
      button.textContent = 'Outside button'
      document.body.appendChild(button)
      button.focus()
      
      render(
        <LoadingOverlay isLoading={true} trapFocus={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(document.activeElement).toBe(button)
      
      document.body.removeChild(button)
    })

    it('should trap focus when trapFocus is true and loading', () => {
      const outsideButton = document.createElement('button')
      outsideButton.textContent = 'Outside button'
      document.body.appendChild(outsideButton)
      outsideButton.focus()
      
      render(
        <LoadingOverlay isLoading={true} trapFocus={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Focus should move to the overlay
      expect(document.activeElement).not.toBe(outsideButton)
      
      document.body.removeChild(outsideButton)
    })

    it('should restore focus when loading ends', async () => {
      const button = document.createElement('button')
      button.textContent = 'Original focus'
      document.body.appendChild(button)
      button.focus()
      
      const { rerender } = render(
        <LoadingOverlay isLoading={true} trapFocus={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Focus moved away from button
      expect(document.activeElement).not.toBe(button)
      
      // Stop loading
      rerender(
        <LoadingOverlay isLoading={false} trapFocus={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Focus should be restored
      await waitFor(() => {
        expect(document.activeElement).toBe(button)
      })
      
      document.body.removeChild(button)
    })

    it('should render hidden button for focus trap', () => {
      render(
        <LoadingOverlay isLoading={true} trapFocus={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      const hiddenButton = screen.getByRole('button', { hidden: true })
      expect(hiddenButton).toHaveStyle({ position: 'absolute', opacity: '0' })
      expect(hiddenButton).toHaveAttribute('aria-hidden', 'true')
    })

    it('should handle Tab key navigation in focus trap', () => {
      render(
        <LoadingOverlay isLoading={true} trapFocus={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      const hiddenButton = screen.getByRole('button', { hidden: true })
      hiddenButton.focus()
      
      // Tab should cycle back to first element
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
      
      // Shift+Tab should cycle to last element
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    })

    it('should not trap focus when not loading', () => {
      const button = document.createElement('button')
      button.textContent = 'Outside button'
      document.body.appendChild(button)
      button.focus()
      
      render(
        <LoadingOverlay isLoading={false} trapFocus={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(document.activeElement).toBe(button)
      
      document.body.removeChild(button)
    })
  })

  describe('Dynamic loading state', () => {
    it('should show and hide overlay based on loading prop', () => {
      const { rerender } = render(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument()
      
      rerender(
        <LoadingOverlay isLoading={true}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument()
      
      rerender(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument()
    })

    it('should update message dynamically', () => {
      const { rerender } = render(
        <LoadingOverlay isLoading={true} message="Loading...">
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByRole('status')).toHaveTextContent('Loading...')
      
      rerender(
        <LoadingOverlay isLoading={true} message="Almost done...">
          <div>Content</div>
        </LoadingOverlay>
      )
      
      expect(screen.getByRole('status')).toHaveTextContent('Almost done...')
    })
  })

  describe('Multiple LoadingOverlays', () => {
    it('should handle multiple overlays independently', () => {
      render(
        <>
          <LoadingOverlay isLoading={true} message="Loading 1">
            <div>Content 1</div>
          </LoadingOverlay>
          <LoadingOverlay isLoading={false} message="Loading 2">
            <div>Content 2</div>
          </LoadingOverlay>
        </>
      )
      
      expect(screen.getByRole('status')).toHaveTextContent('Loading 1')
      const allOverlays = screen.queryAllByRole('status')
      expect(allOverlays).toHaveLength(1)
      expect(screen.getAllByTestId('loading-overlay')).toHaveLength(1)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty children', () => {
      render(<LoadingOverlay isLoading={true}>{null}</LoadingOverlay>)
      
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument()
    })

    it('should handle complex children', () => {
      render(
        <LoadingOverlay isLoading={true}>
          <div>
            <h1>Title</h1>
            <p>Paragraph</p>
            <button>Button</button>
          </div>
        </LoadingOverlay>
      )
      
      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument()
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Paragraph')).toBeInTheDocument()
      expect(screen.getByText('Button')).toBeInTheDocument()
    })

    it('should handle rapid loading state changes', () => {
      const { rerender } = render(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Rapidly toggle loading state
      for (let i = 0; i < 5; i++) {
        rerender(
          <LoadingOverlay isLoading={i % 2 === 0}>
            <div>Content</div>
          </LoadingOverlay>
        )
      }
      
      // Should end with loading (i=4, 4%2=0, so loading=true)
      expect(screen.queryByTestId('loading-overlay')).toBeInTheDocument()
    })
  })
})