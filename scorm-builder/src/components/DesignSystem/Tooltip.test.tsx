import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('should render children', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
  })

  it('should show tooltip on hover', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Helpful information">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    
    // Tooltip should not be visible initially
    expect(screen.queryByText('Helpful information')).not.toBeInTheDocument()
    
    // Hover over the button
    await user.hover(button)
    
    // Tooltip should appear
    await waitFor(() => {
      expect(screen.getByText('Helpful information')).toBeInTheDocument()
    })
  })

  it('should hide tooltip on mouse leave', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Helpful information">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    
    // Show tooltip
    await user.hover(button)
    await waitFor(() => {
      expect(screen.getByText('Helpful information')).toBeInTheDocument()
    })
    
    // Hide tooltip
    await user.unhover(button)
    await waitFor(() => {
      expect(screen.queryByText('Helpful information')).not.toBeInTheDocument()
    })
  })

  it('should show tooltip on focus', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Keyboard accessible">
        <button>Focus me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Focus me' })
    
    // Focus the button
    await user.tab()
    expect(button).toHaveFocus()
    
    // Tooltip should appear
    await waitFor(() => {
      expect(screen.getByText('Keyboard accessible')).toBeInTheDocument()
    })
  })

  it('should support different positions', async () => {
    const user = userEvent.setup()
    const positions = ['top', 'bottom', 'left', 'right'] as const
    
    for (const position of positions) {
      const { unmount } = render(
        <Tooltip content="Positioned tooltip" position={position}>
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button', { name: 'Hover me' })
      await user.hover(button)
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(tooltip).toHaveClass(`tooltip-${position}`)
      })
      
      unmount()
    }
  })

  it('should support custom delay', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Delayed tooltip" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    
    // Start hovering
    await user.hover(button)
    
    // Should not appear immediately
    expect(screen.queryByText('Delayed tooltip')).not.toBeInTheDocument()
    
    // Should appear after delay
    await waitFor(() => {
      expect(screen.getByText('Delayed tooltip')).toBeInTheDocument()
    }, { timeout: 600 })
  })

  it('should be disabled when disabled prop is true', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Disabled tooltip" disabled>
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    await user.hover(button)
    
    // Wait a bit and confirm tooltip doesn't appear
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(screen.queryByText('Disabled tooltip')).not.toBeInTheDocument()
  })

  it('should support custom className', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Custom tooltip" className="custom-tooltip">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    await user.hover(button)
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveClass('custom-tooltip')
    })
  })

  it('should handle React node content', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip 
        content={
          <div>
            <strong>Bold text</strong>
            <span>Normal text</span>
          </div>
        }
      >
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    await user.hover(button)
    
    await waitFor(() => {
      expect(screen.getByText('Bold text')).toBeInTheDocument()
      expect(screen.getByText('Normal text')).toBeInTheDocument()
    })
  })

  it('should have proper ARIA attributes', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Accessible tooltip">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Hover me' })
    
    // Button should have aria-describedby when tooltip is shown
    await user.hover(button)
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip')
      const tooltipId = tooltip.id
      expect(button).toHaveAttribute('aria-describedby', tooltipId)
    })
  })

  it('should handle touch events on mobile', async () => {
    render(
      <Tooltip content="Touch tooltip">
        <button>Touch me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button', { name: 'Touch me' })
    
    // Simulate touch
    fireEvent.touchStart(button)
    
    await waitFor(() => {
      expect(screen.getByText('Touch tooltip')).toBeInTheDocument()
    })
    
    // Touch outside to close
    fireEvent.touchStart(document.body)
    
    await waitFor(() => {
      expect(screen.queryByText('Touch tooltip')).not.toBeInTheDocument()
    })
  })
})