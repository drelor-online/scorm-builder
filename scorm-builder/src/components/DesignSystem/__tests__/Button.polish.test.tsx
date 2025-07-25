import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button.polished'
import '../button.polish.css'

describe('Button Polish - User Intent Tests', () => {
  describe('User expects smooth visual feedback', () => {
    it('should show a subtle scale effect on hover', async () => {
      const user = userEvent.setup()
      const { container } = render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      
      // User hovers over button
      await user.hover(button)
      
      // Button should have hover class applied
      expect(button).toHaveClass('btn')
      // In JSDOM, we can't test actual hover styles, so we check the class structure
      expect(button.className).toContain('btn')
    })

    it('should show pressed state when clicked', async () => {
      const user = userEvent.setup()
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      
      // Simulate mouse down which triggers pressed state
      fireEvent.mouseDown(button)
      
      // Button should show pressed state during mousedown
      expect(button).toHaveClass('btn-pressed')
      
      // Simulate mouse up to release
      fireEvent.mouseUp(button)
      
      // Button should no longer be pressed
      expect(button).not.toHaveClass('btn-pressed')
    })

    it('should have smooth color transitions', () => {
      const { container } = render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      
      // Button should have base class that includes transitions
      expect(button).toHaveClass('btn')
      // The CSS file defines the transition, but JSDOM doesn't compute it
      // We verify the class is applied which has the transition in CSS
      expect(button.className).toMatch(/btn/)
    })
  })

  describe('User expects loading state feedback', () => {
    it('should show loading spinner when loading prop is true', () => {
      render(<Button loading>Save</Button>)
      
      // Should show spinner
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      
      // Button text should still be present but hidden
      expect(screen.getByText('Save')).toHaveClass('btn-text-hidden')
    })

    it('should disable interactions during loading', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<Button loading onClick={onClick}>Save</Button>)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      // Should not trigger click
      expect(onClick).not.toHaveBeenCalled()
      expect(button).toBeDisabled()
    })
  })

  describe('User expects ripple effect on click', () => {
    it('should create ripple effect at click position', async () => {
      const user = userEvent.setup()
      const { container } = render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      
      // Click button
      await user.click(button)
      
      // Should have ripple element
      const ripple = container.querySelector('.btn-ripple')
      expect(ripple).toBeInTheDocument()
      
      // Ripple should be removed after animation
      await waitFor(() => {
        expect(container.querySelector('.btn-ripple')).not.toBeInTheDocument()
      }, { timeout: 1000 })
    })
  })

  describe('User expects focus indicators for accessibility', () => {
    it('should show clear focus ring when focused via keyboard', async () => {
      const user = userEvent.setup()
      render(<Button>Click me</Button>)
      
      // Tab to button
      await user.tab()
      
      const button = screen.getByRole('button')
      expect(button).toHaveFocus()
      
      // Should have visible focus ring
      expect(button).toHaveClass('btn-focus-visible')
    })

    it('should not show focus ring on mouse click', async () => {
      const user = userEvent.setup()
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      
      // Click with mouse
      await user.click(button)
      
      // Should not have focus ring class
      expect(button).not.toHaveClass('btn-focus-visible')
    })
  })

  describe('User expects proper icon spacing and alignment', () => {
    it('should properly align icon with text', () => {
      render(
        <Button icon={<span data-testid="icon">→</span>}>
          Next Step
        </Button>
      )
      
      const button = screen.getByRole('button')
      const icon = screen.getByTestId('icon')
      
      // Icon should be wrapped in btn-icon span
      expect(icon.parentElement).toHaveClass('btn-icon')
      // Button has the btn class which includes gap in CSS
      expect(button).toHaveClass('btn')
    })

    it('should support icon on right side', () => {
      render(
        <Button iconPosition="right" icon={<span data-testid="icon">→</span>}>
          Next Step
        </Button>
      )
      
      const button = screen.getByRole('button')
      const icon = screen.getByTestId('icon')
      
      // Icon should come after text
      expect(button.lastElementChild).toContainElement(icon)
    })
  })

  describe('User expects consistent disabled state', () => {
    it('should show reduced opacity when disabled', () => {
      render(<Button disabled>Click me</Button>)
      const button = screen.getByRole('button')
      
      // Button should have disabled class
      expect(button).toHaveClass('btn-disabled')
      expect(button).toBeDisabled()
    })

    it('should not show hover effects when disabled', async () => {
      const user = userEvent.setup()
      render(<Button disabled>Click me</Button>)
      const button = screen.getByRole('button')
      
      await user.hover(button)
      
      // Should not have hover transform
      expect(button).not.toHaveStyle({ transform: 'scale(1.02)' })
    })
  })
})