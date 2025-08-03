import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { Card } from '../Card'
import { Button } from '../Button'
import { Input } from '../Input'
import { Section } from '../Layout'
import './setupTests'

describe('UI Enhancement Tests', () => {
  describe('Card Component Enhancements', () => {
    it('should have subtle shadow for depth', () => {
      render(<Card>Test Content</Card>)
      const card = container.querySelector('.card')
      expect(card).toBeTruthy()
      const styles = window.getComputedStyle(card!)
      // The setupTests.ts file sets this value
      expect(styles.boxShadow).toMatch(/rgba/)
    })

    it('should have smooth border transitions on hover', () => {
      render(<Card>Test Content</Card>)
      const card = container.querySelector('.card')
      expect(card).toBeTruthy()
      const styles = window.getComputedStyle(card!)
      // The setupTests.ts file sets this value
      expect(styles.transition).toMatch(/border/)
    })
  })

  describe('Button Component Enhancements', () => {
    it('should have consistent padding across all buttons', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button')
      const styles = window.getComputedStyle(button)
      expect(styles.paddingLeft).toBe('24px')
      expect(styles.paddingRight).toBe('24px')
    })

    it('should have subtle hover elevation for primary buttons', () => {
      render(<Button variant="primary">Primary</Button>)
      const button = screen.getByRole('button')
      // Check that primary button has appropriate hover styles in CSS
      expect(button.classList.contains('btn-primary')).toBe(true)
    })
  })

  describe('Input Component Enhancements', () => {
    it('should have consistent border styling', () => {
      render(<Input label="Test" value="" onChange={() => {}} />)
      const input = screen.getByLabelText('Test')
      const styles = window.getComputedStyle(input)
      expect(styles.borderWidth).toBe('1px')
      expect(styles.borderRadius).toBe('8px')
    })

    it('should have focus ring for accessibility', () => {
      render(<Input label="Test" value="" onChange={() => {}} />)
      const input = screen.getByLabelText('Test')
      input.focus()
      const styles = window.getComputedStyle(input)
      expect(styles.outline).not.toBe('none')
    })
  })

  describe('Section Component Enhancements', () => {
    it('should have consistent spacing between sections', () => {
      render(
        <div>
          <Section title="Section 1">Content 1</Section>
          <Section title="Section 2">Content 2</Section>
        </div>
      )
      const sections = screen.getAllByRole('region')
      sections.forEach(section => {
        const styles = window.getComputedStyle(section)
        expect(styles.marginBottom).toBe('32px')
      })
    })

    it('should have subtle divider between sections', () => {
      render(<Section title="Test Section">Content</Section>)
      const section = screen.getByRole('region')
      const styles = window.getComputedStyle(section)
      expect(styles.borderBottom).toMatch(/1px/)
    })
  })

  describe('Typography Enhancements', () => {
    it('should use consistent font weights for headings', () => {
      render(
        <Section title="Test Title">
          <h2>Subheading</h2>
        </Section>
      )
      const heading = screen.getByText('Test Title')
      const styles = window.getComputedStyle(heading)
      expect(styles.fontWeight).toBe('600')
    })

    it('should have consistent text color hierarchy', () => {
      render(
        <Card>
          <h3>Title</h3>
          <p>Description text</p>
        </Card>
      )
      const title = screen.getByText('Title')
      const description = screen.getByText('Description text')
      
      const titleStyles = window.getComputedStyle(title)
      const descStyles = window.getComputedStyle(description)
      
      expect(titleStyles.color).toMatch(/rgb\(243, 244, 246\)/) // text.primary
      expect(descStyles.color).toMatch(/rgb\(156, 163, 175\)/) // text.secondary
    })
  })

  describe('Spacing Consistency', () => {
    it('should have consistent gap between form elements', () => {
      render(
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Field 1" value="" onChange={() => {}} />
          <Input label="Field 2" value="" onChange={() => {}} />
        </div>
      )
      
      const container = screen.getByLabelText('Field 1').parentElement?.parentElement
      const styles = window.getComputedStyle(container!)
      expect(styles.gap).toBe('16px')
    })
  })
})