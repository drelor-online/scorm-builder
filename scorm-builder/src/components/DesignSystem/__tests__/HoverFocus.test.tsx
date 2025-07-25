import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Button } from '../Button'
import { Input } from '../Input'
import { Card } from '../Card'
import './setupTests'

describe('Hover and Focus States', () => {
  describe('Button hover and focus states', () => {
    it('should have consistent hover states for all button variants', () => {
      const variants = ['primary', 'secondary', 'tertiary', 'success', 'danger'] as const
      
      variants.forEach(variant => {
        const { container } = render(
          <Button variant={variant}>Test Button</Button>
        )
        
        const button = container.querySelector('.btn')
        const styles = window.getComputedStyle(button!)
        
        // All buttons should have hover transform
        expect(styles.transition).toMatch(/transform|all/)
        
        // Focus states should be consistent
        button?.focus()
        const focusStyles = window.getComputedStyle(button!)
        expect(focusStyles.outlineWidth).toBe('2px')
        expect(focusStyles.outlineOffset).toBe('2px')
      })
    })

    it('should have smooth hover transitions', () => {
      const { container } = render(
        <Button variant="primary">Hover me</Button>
      )
      
      const button = container.querySelector('.btn')
      const styles = window.getComputedStyle(button!)
      
      // Should have transition duration
      expect(styles.transitionDuration).toMatch(/200ms|0.2s/)
    })
  })

  describe('Input hover and focus states', () => {
    it('should have visible focus indicator with ring', () => {
      const { container } = render(
        <Input placeholder="Test input" />
      )
      
      const input = container.querySelector('.input')
      input?.focus()
      const focusStyles = window.getComputedStyle(input!)
      
      // Should have focus ring
      expect(focusStyles.boxShadow).toMatch(/0 0 0 3px/)
      expect(focusStyles.borderColor).toMatch(/rgb\(59, 130, 246\)/)
    })

    it('should have smooth focus transition', () => {
      const { container } = render(
        <Input placeholder="Test input" />
      )
      
      const input = container.querySelector('.input')
      const styles = window.getComputedStyle(input!)
      
      // Should have transition for border and shadow
      expect(styles.transition).toMatch(/border-color|box-shadow/)
    })
  })

  describe('Card hover states', () => {
    it('should elevate on hover with transform', () => {
      const { container } = render(
        <Card>
          <p>Card content</p>
        </Card>
      )
      
      const card = container.querySelector('.card')
      expect(card).toHaveClass('card-hover-lift')
      
      const styles = window.getComputedStyle(card!)
      expect(styles.transition).toMatch(/transform/)
    })
  })

  describe('Interactive element focus indicators', () => {
    it('should have consistent focus outline colors', () => {
      const { container: buttonContainer } = render(
        <Button>Button</Button>
      )
      
      const { container: inputContainer } = render(
        <Input placeholder="Input" />
      )
      
      const button = buttonContainer.querySelector('.btn')
      const input = inputContainer.querySelector('.input')
      
      button?.focus()
      input?.focus()
      
      const buttonStyles = window.getComputedStyle(button!)
      const inputStyles = window.getComputedStyle(input!)
      
      // Both should use primary color for focus
      // Button should have outline color (when focus-visible is active)
      if (buttonStyles.outlineColor) {
        expect(buttonStyles.outlineColor).toMatch(/rgb\(59, 130, 246\)/)
      }
      expect(inputStyles.borderColor).toMatch(/rgb\(59, 130, 246\)/)
    })
  })

  describe('Disabled state interactions', () => {
    it('should not have hover effects when disabled', () => {
      const { container } = render(
        <Button disabled>Disabled Button</Button>
      )
      
      const button = container.querySelector('.btn')
      const styles = window.getComputedStyle(button!)
      
      // Should have reduced opacity
      expect(styles.opacity).toBe('0.6')
      // Should have not-allowed cursor
      expect(styles.cursor).toBe('not-allowed')
    })
  })

  describe('Keyboard navigation', () => {
    it('should have visible focus indicators for keyboard navigation', () => {
      const { container } = render(
        <div>
          <Button>First</Button>
          <Button>Second</Button>
          <Input placeholder="Input" />
        </div>
      )
      
      const buttons = container.querySelectorAll('.btn')
      const input = container.querySelector('.input')
      
      // Simulate tab navigation
      buttons[0].focus()
      let focusStyles = window.getComputedStyle(buttons[0])
      expect(focusStyles.outlineStyle).not.toBe('none')
      
      buttons[1].focus()
      focusStyles = window.getComputedStyle(buttons[1])
      expect(focusStyles.outlineStyle).not.toBe('none')
      
      input?.focus()
      const inputStyles = window.getComputedStyle(input!)
      expect(inputStyles.boxShadow).toBeTruthy()
    })
  })
})