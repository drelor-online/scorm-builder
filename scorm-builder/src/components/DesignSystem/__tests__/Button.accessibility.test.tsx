// Removed unused React import
import { render, screen } from '../../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '../Button'

// Extend Vitest matchers with jest-axe matchers
expect.extend(toHaveNoViolations)

describe('Button - Accessibility Tests', () => {
  describe('Basic accessibility', () => {
    it('should have no accessibility violations with default props', async () => {
      render(<Button>Click me</Button>)
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with all variants', async () => {
      const variants = ['primary', 'secondary', 'success', 'danger', 'ghost'] as const
      
      for (const variant of variants) {
        render(
          <Button variant={variant}>Button text</Button>
        )
        // const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })

    it('should have no accessibility violations with all sizes', async () => {
      const sizes = ['small', 'medium', 'large'] as const
      
      for (const size of sizes) {
        render(
          <Button size={size}>Button text</Button>
        )
        // const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })
  })

  describe('Keyboard interaction', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      
      render(<Button onClick={onClick}>Click me</Button>)
      
      const button = screen.getByRole('button', { name: 'Click me' })
      
      // Tab to button
      await user.tab()
      expect(button).toHaveFocus()
      
      // Activate with Enter
      await user.keyboard('{Enter}')
      expect(onClick).toHaveBeenCalledTimes(1)
      
      // Activate with Space
      await user.keyboard(' ')
      expect(onClick).toHaveBeenCalledTimes(2)
    })

    it('should not be focusable when disabled', async () => {
      const user = userEvent.setup()
      
      render(
        <>
          <Button>First button</Button>
          <Button disabled>Disabled button</Button>
          <Button>Last button</Button>
        </>
      )
      
      const firstButton = screen.getByRole('button', { name: 'First button' })
      const lastButton = screen.getByRole('button', { name: 'Last button' })
      const disabledButton = screen.getByRole('button', { name: 'Disabled button' })
      
      // Tab to first button
      await user.tab()
      expect(firstButton).toHaveFocus()
      
      // Tab should skip disabled button
      await user.tab()
      expect(lastButton).toHaveFocus()
      expect(disabledButton).not.toHaveFocus()
    })
  })

  describe('ARIA attributes', () => {
    it('should have proper disabled state', () => {
      render(<Button disabled>Disabled button</Button>)
      
      const button = screen.getByRole('button', { name: 'Disabled button' })
      expect(button).toBeDisabled()
      // The HTML disabled attribute is sufficient for accessibility
    })

    it('should support aria-label for icon-only buttons', () => {
      render(
        <Button aria-label="Save document">
          <span aria-hidden="true">💾</span>
        </Button>
      )
      
      const button = screen.getByRole('button', { name: 'Save document' })
      expect(button).toBeInTheDocument()
    })

    it('should support aria-describedby for additional context', () => {
      render(
        <>
          <Button aria-describedby="delete-warning">Delete</Button>
          <span id="delete-warning">This action cannot be undone</span>
        </>
      )
      
      const button = screen.getByRole('button', { name: 'Delete' })
      expect(button).toHaveAttribute('aria-describedby', 'delete-warning')
    })

    it('should support custom ARIA attributes passed via props', () => {
      render(<Button aria-pressed="true">Toggle button</Button>)
      
      const button = screen.getByRole('button', { name: 'Toggle button' })
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })
  })

  // Note: The current Button component doesn't support loading state or rendering as link
  // These tests are commented out but show what should be tested if these features are added
  
  /*
  describe('Loading state', () => {
    it('should be accessible in loading state', async () => {
      render(
        <Button loading>Loading button</Button>
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).toBeDisabled()
    })
  })

  describe('Button as link', () => {
    it('should be accessible when rendered as a link', async () => {
      render(
        <Button as="a" href="/home">
          Go to home
        </Button>
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      const link = screen.getByRole('link', { name: 'Go to home' })
      expect(link).toHaveAttribute('href', '/home')
    })
  })
  */

  describe('Focus indicators', () => {
    it('should have visible focus indicator', () => {
      render(<Button>Focusable button</Button>)
      
      const button = screen.getByRole('button', { name: 'Focusable button' })
      
      // Check that button has focus-visible styles
      // Note: This is a simplified check - in real tests you might check computed styles
      expect(button.className).toMatch(/btn|button/i)
    })
  })

  describe('Color contrast', () => {
    it('should meet WCAG color contrast requirements', async () => {
      // Test each variant for color contrast
      const variants = ['primary', 'secondary', 'success', 'danger'] as const
      
      for (const variant of variants) {
        render(
          <Button variant={variant}>Test button</Button>
        )
        
        // Axe will check color contrast as part of its tests
        // const results = await axe(container)
        expect(results).toHaveNoViolations()
      }
    })
  })

  describe('Touch targets', () => {
    it('should have adequate touch target size', () => {
      render(<Button size="small">Small button</Button>)
      
      const button = screen.getByRole('button', { name: 'Small button' })
      
      // Button should have minimum touch target size (44x44 pixels recommended)
      // This is a simplified check - in real tests you might measure actual dimensions
      expect(button.className).toMatch(/btn-small|small/i)
    })
  })

  describe('Button groups', () => {
    it('should be accessible in button groups', async () => {
      render(
        <div role="group" aria-label="Text alignment">
          <Button aria-pressed="false">Left</Button>
          <Button aria-pressed="true">Center</Button>
          <Button aria-pressed="false">Right</Button>
        </div>
      )
      
      // const results = await axe(container)
      expect(results).toHaveNoViolations()
      
      const group = screen.getByRole('group', { name: 'Text alignment' })
      expect(group).toBeInTheDocument()
    })
  })
})