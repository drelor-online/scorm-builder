// Removed unused React import
import { describe, it, expect, vi } from 'vitest'
import { render, screen , waitFor } from '../../../test/testProviders'
import { LoadingOverlay } from '../LoadingOverlay'
import { Skeleton } from '../Skeleton'
import { ProgressBar } from '../ProgressBar'
import { StepProgress } from '../StepProgress'
import { LoadingButton } from '../LoadingButton'
import userEvent from '@testing-library/user-event'

describe('Loading States - User Intent Tests', () => {
  describe('User expects clear loading feedback', () => {
    it('should show loading overlay with message', () => {
      render(
        <LoadingOverlay isLoading={true} message="Saving your changes...">
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Loading message should be visible
      expect(screen.getByText('Saving your changes...')).toBeInTheDocument()
      
      // Content should still be in DOM but visually hidden
      expect(screen.getByText('Content').parentElement).toHaveAttribute('aria-hidden', 'true')
    })

    it('should show skeleton loader for content placeholders', () => {
      render(
        <div>
          <Skeleton variant="text" width="200px" />
          <Skeleton variant="rect" width="100%" height="100px" />
          <Skeleton variant="circle" size="40px" />
        </div>
      )
      
      const skeletons = screen.getAllByTestId(/skeleton-/)
      expect(skeletons).toHaveLength(3)
      
      // Check skeleton animations
      expect(skeletons[0]).toHaveClass('skeleton-pulse')
      expect(skeletons[1]).toHaveClass('skeleton-pulse')
      expect(skeletons[2]).toHaveClass('skeleton-pulse')
    })

    it('should support shimmer effect for skeletons', () => {
      render(
        <Skeleton variant="text" animation="shimmer" />
      )
      
      const skeleton = screen.getByTestId('skeleton-text')
      expect(skeleton).toHaveClass('skeleton-shimmer')
    })
  })

  describe('User expects progress indication', () => {
    it('should show determinate progress bar', () => {
      render(
        <ProgressBar value={75} max={100} label="Upload progress" />
      )
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-label', 'Upload progress')
      
      // Visual progress indicator
      const fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '75%' })
    })

    it('should show indeterminate progress for unknown duration', () => {
      render(
        <ProgressBar indeterminate label="Processing..." />
      )
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).not.toHaveAttribute('aria-valuenow')
      expect(progressBar).toHaveClass('progress-indeterminate')
    })

    it('should show step-based progress', () => {
      const steps = [
        { label: 'Upload', status: 'completed' },
        { label: 'Process', status: 'active' },
        { label: 'Complete', status: 'pending' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      // Check step states
      expect(screen.getByText('Upload')).toHaveAttribute('data-status', 'completed')
      expect(screen.getByText('Process')).toHaveAttribute('data-status', 'active')
      expect(screen.getByText('Complete')).toHaveAttribute('data-status', 'pending')
      
      // Check accessibility
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '2')
      expect(progressBar).toHaveAttribute('aria-valuemax', '3')
    })
  })

  describe('User expects loading button states', () => {
    it('should show loading state in button', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      render(
        <LoadingButton onClick={onClick}>
          Save Changes
        </LoadingButton>
      )
      
      const button = screen.getByRole('button')
      
      // Click button
      await user.click(button)
      
      // Should show loading state
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(button).toBeDisabled()
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(button).not.toBeDisabled()
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
    })

    it('should customize loading text', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })
      
      render(
        <LoadingButton 
          onClick={onClick}
          loadingText="Processing your request..."
        >
          Submit
        </LoadingButton>
      )
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(screen.getByText('Processing your request...')).toBeInTheDocument()
    })
  })

  describe('User expects loading state transitions', () => {
    it('should smoothly transition between loading states', async () => {
      const { rerender } = render(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Content should be visible
      expect(screen.getByText('Content')).not.toHaveAttribute('aria-hidden')
      
      // Start loading
      rerender(
        <LoadingOverlay isLoading={true} fadeIn>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Should have transition class
      const overlay = screen.getByTestId('loading-overlay')
      expect(overlay).toHaveClass('loading-overlay-fade-in')
    })

    it('should show estimated time remaining', () => {
      render(
        <ProgressBar 
          value={30} 
          max={100} 
          showTimeRemaining
          startTime={Date.now() - 3000} // Started 3 seconds ago
        />
      )
      
      // Should calculate and show time remaining
      expect(screen.getByText(/remaining/i)).toBeInTheDocument()
    })
  })

  describe('User expects accessible loading states', () => {
    it('should announce loading state changes', async () => {
      const { rerender } = render(
        <LoadingOverlay isLoading={false}>
          <div>Content</div>
        </LoadingOverlay>
      )
      
      rerender(
        <LoadingOverlay isLoading={true} message="Loading data...">
          <div>Content</div>
        </LoadingOverlay>
      )
      
      // Should have live region announcement
      const message = screen.getByText('Loading data...')
      expect(message).toBeInTheDocument()
      
      // Find the element with role="status" that contains our message
      const statusElements = screen.getAllByRole('status')
      const liveRegion = statusElements.find(el => el.textContent?.includes('Loading data...'))
      
      expect(liveRegion).toBeDefined()
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should maintain focus management during loading', async () => {
      const user = userEvent.setup()
      
      render(
        <div>
          <button>Before</button>
          <LoadingOverlay isLoading={true} trapFocus>
            <button>Inside</button>
          </LoadingOverlay>
          <button>After</button>
        </div>
      )
      
      // When loading with trapFocus, focus should be moved to the overlay
      const focusableElements = document.querySelectorAll(
        '.loading-overlay button, .loading-overlay [tabindex]:not([tabindex="-1"])'
      )
      
      // Should have focusable elements for focus trap
      expect(focusableElements.length).toBeGreaterThan(0)
      
      // Content inside should be aria-hidden
      expect(screen.getByText('Inside').parentElement).toHaveAttribute('aria-hidden', 'true')
    })
  })
})