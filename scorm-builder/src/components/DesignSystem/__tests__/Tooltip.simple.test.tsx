import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

describe('Tooltip Component - Simple Tests', () => {
  it('should render children', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('should show tooltip on hover', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Hover me')
    
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    
    fireEvent.mouseEnter(button)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Tooltip content')).toBeInTheDocument()
    })
  })

  it('should hide tooltip on mouse leave', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Hover me')
    
    fireEvent.mouseEnter(button)
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })
    
    fireEvent.mouseLeave(button)
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('should show tooltip on focus', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Focus me</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Focus me')
    
    fireEvent.focus(button)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })
  })

  it('should hide tooltip on blur', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Focus me</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Focus me')
    
    fireEvent.focus(button)
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })
    
    fireEvent.blur(button)
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('should apply position class', async () => {
    const { rerender } = render(
      <Tooltip content="Tooltip" position="top">
        <button>Button</button>
      </Tooltip>
    )
    
    fireEvent.mouseEnter(screen.getByText('Button'))
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveClass('tooltip-top')
    })
    
    fireEvent.mouseLeave(screen.getByText('Button'))
    
    rerender(
      <Tooltip content="Tooltip" position="bottom">
        <button>Button</button>
      </Tooltip>
    )
    
    fireEvent.mouseEnter(screen.getByText('Button'))
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveClass('tooltip-bottom')
    })
  })

  it('should not show tooltip when disabled', async () => {
    render(
      <Tooltip content="Tooltip" disabled={true}>
        <button>Button</button>
      </Tooltip>
    )
    
    fireEvent.mouseEnter(screen.getByText('Button'))
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('should respect delay prop', async () => {
    render(
      <Tooltip content="Delayed tooltip" delay={100}>
        <button>Button</button>
      </Tooltip>
    )
    
    fireEvent.mouseEnter(screen.getByText('Button'))
    
    // Should not be visible immediately
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    
    // Should be visible after delay
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    }, { timeout: 200 })
  })

  it('should preserve child event handlers', async () => {
    const handleMouseEnter = vi.fn()
    const handleMouseLeave = vi.fn()
    const handleFocus = vi.fn()
    const handleBlur = vi.fn()
    
    render(
      <Tooltip content="Tooltip">
        <button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          Button
        </button>
      </Tooltip>
    )
    
    const button = screen.getByText('Button')
    
    fireEvent.mouseEnter(button)
    expect(handleMouseEnter).toHaveBeenCalled()
    
    fireEvent.mouseLeave(button)
    expect(handleMouseLeave).toHaveBeenCalled()
    
    fireEvent.focus(button)
    expect(handleFocus).toHaveBeenCalled()
    
    fireEvent.blur(button)
    expect(handleBlur).toHaveBeenCalled()
  })

  it('should add aria-describedby when visible', async () => {
    render(
      <Tooltip content="Tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Button')
    
    expect(button).not.toHaveAttribute('aria-describedby')
    
    fireEvent.mouseEnter(button)
    
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-describedby')
    })
  })

  it('should show tooltip on touch', async () => {
    render(
      <Tooltip content="Touch tooltip">
        <button>Touch me</button>
      </Tooltip>
    )
    
    const button = screen.getByText('Touch me')
    
    fireEvent.touchStart(button)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })
  })

  it('should apply custom className', async () => {
    render(
      <Tooltip content="Tooltip" className="custom-tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    fireEvent.mouseEnter(screen.getByText('Button'))
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveClass('custom-tooltip')
    })
  })
})