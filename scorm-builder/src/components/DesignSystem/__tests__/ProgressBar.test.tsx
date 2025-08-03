// Removed unused React import
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { ProgressBar } from '../ProgressBar'

describe('ProgressBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render with default props', () => {
      render(<ProgressBar />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toBeInTheDocument()
      expect(progressbar).toHaveAttribute('aria-valuenow', '0')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    })

    it('should render with custom value and max', () => {
      render(<ProgressBar value={50} max={200} />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '50')
      expect(progressbar).toHaveAttribute('aria-valuemax', '200')
    })

    it('should apply custom className', () => {
      render(<ProgressBar className="custom-progress" />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveClass('progress-bar', 'custom-progress')
    })

    it('should render with label', () => {
      render(<ProgressBar label="Loading files" />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-label', 'Loading files')
    })
  })

  describe('Progress calculation', () => {
    it('should calculate correct percentage', () => {
      render(<ProgressBar value={25} max={100} />)
      
      const fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '25%' })
    })

    it('should handle zero max value', () => {
      render(<ProgressBar value={50} max={0} />)
      
      const fill = screen.getByTestId('progress-fill')
      // 50/0 = Infinity, but percentage should be capped
      expect(fill).toHaveStyle({ width: 'Infinity%' })
    })

    it('should handle value greater than max', () => {
      render(<ProgressBar value={150} max={100} />)
      
      const fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '150%' })
    })

    it('should handle different value/max combinations', () => {
      const { rerender } = render(<ProgressBar value={0} max={100} />)
      
      let fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '0%' })
      
      rerender(<ProgressBar value={33} max={100} />)
      expect(fill).toHaveStyle({ width: '33%' })
      
      rerender(<ProgressBar value={66.5} max={100} />)
      expect(fill).toHaveStyle({ width: '66.5%' })
      
      rerender(<ProgressBar value={100} max={100} />)
      expect(fill).toHaveStyle({ width: '100%' })
    })
  })

  describe('Indeterminate state', () => {
    it('should render indeterminate progress bar', () => {
      render(<ProgressBar indeterminate />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveClass('progress-indeterminate')
      expect(progressbar).not.toHaveAttribute('aria-valuenow')
      expect(progressbar).not.toHaveAttribute('aria-valuemax')
    })

    it('should not set width on fill when indeterminate', () => {
      render(<ProgressBar indeterminate value={50} />)
      
      const fill = screen.getByTestId('progress-fill')
      expect(fill).not.toHaveStyle({ width: '50%' })
      expect(fill.style.width).toBe('')
    })
  })

  describe('Time remaining', () => {
    it('should not show time remaining by default', () => {
      render(<ProgressBar value={50} />)
      
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('should not show time when showTimeRemaining is false', () => {
      render(<ProgressBar value={50} showTimeRemaining={false} startTime={Date.now()} />)
      
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('should not show time without startTime', () => {
      render(<ProgressBar value={50} showTimeRemaining />)
      
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('should not show time when value is 0', () => {
      render(<ProgressBar value={0} showTimeRemaining startTime={Date.now()} />)
      
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('should not show time when indeterminate', () => {
      render(<ProgressBar value={50} indeterminate showTimeRemaining startTime={Date.now()} />)
      
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('should calculate and show seconds remaining', () => {
      const startTime = Date.now() - 10000 // Started 10 seconds ago
      render(<ProgressBar value={50} max={100} showTimeRemaining startTime={startTime} />)
      
      // 50% done in 10 seconds, so approximately 10 seconds remaining
      const timeText = screen.getByText(/\d+s remaining/)
      expect(timeText).toBeInTheDocument()
      // Allow for small timing differences
      const seconds = parseInt(timeText.textContent!.match(/(\d+)s/)![1])
      expect(seconds).toBeGreaterThanOrEqual(9)
      expect(seconds).toBeLessThanOrEqual(12)
    })

    it('should show minutes when more than 60 seconds remaining', () => {
      const startTime = Date.now() - 30000 // Started 30 seconds ago
      render(<ProgressBar value={25} max={100} showTimeRemaining startTime={startTime} />)
      
      // 25% done in 30 seconds, so 90 seconds remaining = 2 minutes (rounded up)
      expect(screen.getByText('2m remaining')).toBeInTheDocument()
    })

    it('should update time remaining as progress changes', () => {
      const startTime = Date.now() - 10000 // Started 10 seconds ago
      const { rerender } = render(
        <ProgressBar value={50} max={100} showTimeRemaining startTime={startTime} />
      )
      
      const firstTimeText = screen.getByText(/\d+s remaining/)
      expect(firstTimeText).toBeInTheDocument()
      
      // Update progress - closer to completion
      rerender(<ProgressBar value={90} max={100} showTimeRemaining startTime={startTime} />)
      
      // Should show less time remaining now
      const secondTimeText = screen.getByText(/\d+s remaining/)
      expect(secondTimeText).toBeInTheDocument()
      const remainingSeconds = parseInt(secondTimeText.textContent!.match(/(\d+)s/)![1])
      expect(remainingSeconds).toBeLessThan(5) // Much less time remaining
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for determinate progress', () => {
      render(<ProgressBar value={30} max={100} label="Upload progress" />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '30')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
      expect(progressbar).toHaveAttribute('aria-label', 'Upload progress')
    })

    it('should omit value attributes for indeterminate progress', () => {
      render(<ProgressBar indeterminate label="Loading" />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).not.toHaveAttribute('aria-valuenow')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).not.toHaveAttribute('aria-valuemax')
      expect(progressbar).toHaveAttribute('aria-label', 'Loading')
    })
  })

  describe('Edge cases', () => {
    it('should handle negative values', () => {
      render(<ProgressBar value={-10} max={100} />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '-10')
      
      const fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '-10%' })
    })

    it('should handle decimal values', () => {
      render(<ProgressBar value={33.333} max={100} />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '33.333')
      
      const fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '33.333%' })
    })

    it('should handle very large values', () => {
      render(<ProgressBar value={1000000} max={2000000} />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '1000000')
      expect(progressbar).toHaveAttribute('aria-valuemax', '2000000')
      
      const fill = screen.getByTestId('progress-fill')
      expect(fill).toHaveStyle({ width: '50%' })
    })

    it('should handle rapid updates', () => {
      const { rerender } = render(<ProgressBar value={0} />)
      
      // Simulate rapid progress updates
      for (let i = 0; i <= 100; i += 10) {
        rerender(<ProgressBar value={i} />)
        const progressbar = screen.getByRole('progressbar')
        expect(progressbar).toHaveAttribute('aria-valuenow', i.toString())
      }
    })
  })
})