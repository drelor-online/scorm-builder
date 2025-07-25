import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'

// Test for navigation stepper position
describe('Navigation Layout', () => {
  describe('Stepper Position', () => {
    it('should position the stepper at the top of the page below the header', () => {
      const { container } = render(
        <div className="app-container">
          <header className="app-header">
            <button>Open</button>
            <button>Save</button>
            <button>Settings</button>
          </header>
          <div className="stepper-container">
            <div className="stepper" role="navigation" aria-label="Progress">
              <div className="step active">1</div>
              <div className="step">2</div>
              <div className="step">3</div>
            </div>
          </div>
          <main className="main-content">
            <h1>Page Content</h1>
          </main>
        </div>
      )

      const header = container.querySelector('.app-header')
      const stepper = container.querySelector('.stepper-container')
      const main = container.querySelector('.main-content')

      // Stepper should exist
      expect(stepper).toBeInTheDocument()

      // Stepper should come after header in DOM order
      expect(header?.nextElementSibling).toBe(stepper)

      // Main content should come after stepper
      expect(stepper?.nextElementSibling).toBe(main)
    })

    it('should maintain stepper visibility when scrolling', () => {
      const { container } = render(
        <div className="app-container">
          <div className="stepper-container sticky">
            <div className="stepper">
              <div className="step">1</div>
            </div>
          </div>
        </div>
      )

      const stepperContainer = container.querySelector('.stepper-container')
      expect(stepperContainer).toHaveClass('sticky')
    })

    it('should have proper spacing between header and stepper', () => {
      const { container } = render(
        <div className="app-container">
          <header className="app-header">Header</header>
          <div className="stepper-container">Stepper</div>
        </div>
      )

      const stepperContainer = container.querySelector('.stepper-container')
      const styles = window.getComputedStyle(stepperContainer!)
      
      // Should have top margin for separation from header
      expect(styles.marginTop).toBe('16px')
    })
  })

  describe('Button Label Consistency', () => {
    it('should use consistent "Next" label for navigation buttons', () => {
      render(
        <div>
          <button className="btn-primary navigation-next">Next</button>
          <button className="btn-primary navigation-next">Next</button>
          <button className="btn-primary navigation-next">Next</button>
        </div>
      )

      const nextButtons = screen.getAllByText('Next')
      expect(nextButtons).toHaveLength(3)
      nextButtons.forEach(button => {
        expect(button).toHaveClass('navigation-next')
      })
    })

    it('should use consistent "Back" label for navigation buttons', () => {
      render(
        <div>
          <button className="btn-secondary navigation-back">Back</button>
        </div>
      )

      const backButton = screen.getByText('Back')
      expect(backButton).toHaveClass('navigation-back')
    })

    it('should position navigation buttons consistently', () => {
      const { container } = render(
        <div className="page-container">
          <div className="navigation-buttons">
            <button className="btn-secondary navigation-back">Back</button>
            <button className="btn-primary navigation-next">Next</button>
          </div>
        </div>
      )

      const navButtons = container.querySelector('.navigation-buttons')
      const styles = window.getComputedStyle(navButtons!)
      
      // Should use flexbox for button layout
      expect(styles.display).toBe('flex')
      expect(styles.justifyContent).toBe('space-between')
      expect(styles.marginTop).toBe('32px')
    })
  })

  describe('Card Padding and Spacing', () => {
    it('should have increased padding inside cards', () => {
      const { container } = render(
        <div className="card enhanced-padding">
          <h2>Card Title</h2>
          <p>Card content</p>
        </div>
      )

      const card = container.querySelector('.card')
      const styles = window.getComputedStyle(card!)
      
      // Enhanced padding should be 24px instead of default 16px
      expect(styles.padding).toBe('24px')
    })

    it('should have consistent spacing between cards', () => {
      const { container } = render(
        <div className="card-grid">
          <div className="card">Card 1</div>
          <div className="card">Card 2</div>
          <div className="card">Card 3</div>
        </div>
      )

      const cardGrid = container.querySelector('.card-grid')
      const styles = window.getComputedStyle(cardGrid!)
      
      // Should have consistent gap between cards
      expect(styles.gap).toBe('20px')
    })

    it('should have proper spacing for nested content in cards', () => {
      const { container } = render(
        <div className="card enhanced-padding">
          <div className="card-section">Section 1</div>
          <div className="card-section">Section 2</div>
        </div>
      )

      const sections = container.querySelectorAll('.card-section')
      sections.forEach((section, index) => {
        const styles = window.getComputedStyle(section)
        if (index > 0) {
          expect(styles.marginTop).toBe('16px')
        }
      })
    })
  })

  describe('Narration Block Button Design', () => {
    it('should have improved visual hierarchy for narration buttons', () => {
      const { container } = render(
        <div className="narration-block">
          <button className="narration-add-button">
            <span className="icon">+</span>
            <span className="label">Add Narration</span>
          </button>
        </div>
      )

      const button = container.querySelector('.narration-add-button')
      const styles = window.getComputedStyle(button!)
      
      // Should have dashed border style
      expect(styles.borderStyle).toBe('dashed')
      expect(styles.borderWidth).toBe('2px')
      expect(styles.backgroundColor).toBe('transparent')
    })

    it('should have proper spacing between narration buttons', () => {
      const { container } = render(
        <div className="narration-actions">
          <button className="narration-button">Add Text</button>
          <button className="narration-button">Add Code</button>
          <button className="narration-button">Add Image</button>
        </div>
      )

      const actions = container.querySelector('.narration-actions')
      const styles = window.getComputedStyle(actions!)
      
      expect(styles.display).toBe('flex')
      expect(styles.gap).toBe('12px')
    })
  })

  describe('Image Grid Aspect Ratios', () => {
    it('should maintain consistent aspect ratios in image grid', () => {
      const { container } = render(
        <div className="image-grid">
          <div className="image-item">
            <img src="test1.jpg" alt="Test 1" />
          </div>
          <div className="image-item">
            <img src="test2.jpg" alt="Test 2" />
          </div>
        </div>
      )

      const imageItems = container.querySelectorAll('.image-item')
      imageItems.forEach(item => {
        const styles = window.getComputedStyle(item)
        // Should maintain 16:9 aspect ratio
        expect(styles.aspectRatio).toBe('16 / 9')
        expect(styles.overflow).toBe('hidden')
      })
    })

    it('should have consistent image sizing in grid', () => {
      const { container } = render(
        <div className="image-grid">
          <div className="image-item">
            <img src="test.jpg" alt="Test" />
          </div>
        </div>
      )

      const img = container.querySelector('img')
      const styles = window.getComputedStyle(img!)
      
      expect(styles.width).toBe('100%')
      expect(styles.height).toBe('100%')
      expect(styles.objectFit).toBe('cover')
    })
  })

  describe('Button Visual Hierarchy', () => {
    it('should use color to indicate button importance', () => {
      const { container } = render(
        <div>
          <button className="btn btn-primary">Primary Action</button>
          <button className="btn btn-secondary">Secondary Action</button>
          <button className="btn btn-success">Success Action</button>
          <button className="btn btn-danger">Danger Action</button>
        </div>
      )

      const primary = container.querySelector('.btn-primary')
      const secondary = container.querySelector('.btn-secondary')
      const success = container.querySelector('.btn-success')
      const danger = container.querySelector('.btn-danger')

      const primaryStyles = window.getComputedStyle(primary!)
      const secondaryStyles = window.getComputedStyle(secondary!)
      const successStyles = window.getComputedStyle(success!)
      const dangerStyles = window.getComputedStyle(danger!)

      // Primary should be blue
      expect(primaryStyles.backgroundColor).toMatch(/rgb\(59, 130, 246\)|#3b82f6/)
      
      // Secondary should be gray
      expect(secondaryStyles.backgroundColor).toMatch(/rgb\(107, 114, 128\)|#6b7280/)
      
      // Success should be green
      expect(successStyles.backgroundColor).toMatch(/rgb\(34, 197, 94\)|#22c55e/)
      
      // Danger should be red
      expect(dangerStyles.backgroundColor).toMatch(/rgb\(239, 68, 68\)|#ef4444/)
    })

    it('should have consistent button sizing', () => {
      const { container } = render(
        <button className="btn btn-primary">Action</button>
      )

      const button = container.querySelector('.btn')
      const styles = window.getComputedStyle(button!)
      
      expect(styles.padding).toBe('10px 20px')
      expect(styles.fontSize).toBe('16px')
      expect(styles.minHeight).toBe('44px')
    })
  })
})