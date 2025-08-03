// Removed unused React import
import { render } from '../../test/testProviders'
import '@testing-library/jest-dom'

// Import all major components
import { CourseSeedInput } from '../CourseSeedInput'
import { AIPromptGenerator } from '../AIPromptGenerator'
import { JSONImportValidator } from '../JSONImportValidator'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
import { ActivitiesEditor } from '../ActivitiesEditor'
import { SCORMPackageBuilder } from '../SCORMPackageBuilder'

describe('Systematic Padding Checks', () => {
  describe('Button spacing checks', () => {
    it('should have proper spacing between adjacent buttons', () => {
      render(
        <div>
          <button>Button 1</button>
          <button>Button 2</button>
        </div>
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons).toHaveLength(2)
      
      // Check that buttons are not directly adjacent (should have gap)
      const parent = buttons[0].parentElement
      const computedStyle = parent ? window.getComputedStyle(parent) : null
      
      // Parent should have gap or buttons should have margin
      expect(computedStyle?.gap || '0').not.toBe('0')
    })

    it('should have proper spacing between buttons and text fields', () => {
      render(
        <div>
          <input type="text" />
          <button>Submit</button>
        </div>
      )

      const input = container.querySelector('input')
      const button = container.querySelector('button')
      
      expect(input).toBeInTheDocument()
      expect(button).toBeInTheDocument()
      
      // Check for spacing between input and button
      const parent = input?.parentElement
      const parentStyle = parent ? window.getComputedStyle(parent) : null
      
      expect(parentStyle?.gap || '0').not.toBe('0')
    })
  })

  describe('Form field spacing', () => {
    it('should have consistent spacing between form fields', () => {
      render(
        <div className="form-section">
          <div className="input-wrapper">
            <label>Field 1</label>
            <input type="text" />
          </div>
          <div className="input-wrapper">
            <label>Field 2</label>
            <input type="text" />
          </div>
        </div>
      )

      const wrappers = container.querySelectorAll('.input-wrapper')
      expect(wrappers).toHaveLength(2)
      
      // Check margin between consecutive input wrappers
      wrappers.forEach((wrapper, index) => {
        if (index > 0) {
          const style = window.getComputedStyle(wrapper)
          const marginTop = parseInt(style.marginTop) || 0
          expect(marginTop).toBeGreaterThan(0)
        }
      })
    })

    it('should have spacing between label and input', () => {
      render(
        <div className="input-wrapper">
          <label>Test Label</label>
          <input type="text" />
        </div>
      )

      const label = container.querySelector('label')
      const input = container.querySelector('input')
      
      expect(label).toBeInTheDocument()
      expect(input).toBeInTheDocument()
      
      // Check for margin on label or input
      const labelStyle = label ? window.getComputedStyle(label) : null
      const inputStyle = input ? window.getComputedStyle(input) : null
      
      const labelMarginBottom = parseInt(labelStyle?.marginBottom || '0')
      const inputMarginTop = parseInt(inputStyle?.marginTop || '0')
      
      expect(labelMarginBottom + inputMarginTop).toBeGreaterThan(0)
    })
  })

  describe('Card and section spacing', () => {
    it('should have proper padding inside cards', () => {
      render(
        <div className="card">
          <h3>Card Title</h3>
          <p>Card content</p>
        </div>
      )

      const card = container.querySelector('.card')
      expect(card).toBeInTheDocument()
      
      const cardStyle = card ? window.getComputedStyle(card) : null
      const padding = parseInt(cardStyle?.padding || '0')
      
      expect(padding).toBeGreaterThanOrEqual(16) // At least 16px padding
    })

    it('should have spacing between sections', () => {
      render(
        <div>
          <section className="section">Section 1</section>
          <section className="section">Section 2</section>
        </div>
      )

      const sections = container.querySelectorAll('.section')
      expect(sections).toHaveLength(2)
      
      // Check margin between sections
      const secondSectionStyle = window.getComputedStyle(sections[1])
      const marginTop = parseInt(secondSectionStyle.marginTop) || 0
      const marginBottom = parseInt(window.getComputedStyle(sections[0]).marginBottom) || 0
      
      expect(marginTop + marginBottom).toBeGreaterThan(0)
    })
  })

  describe('Button group spacing', () => {
    it('should have consistent spacing in button groups', () => {
      render(
        <div className="button-group">
          <button>Option 1</button>
          <button>Option 2</button>
          <button>Option 3</button>
        </div>
      )

      const buttonGroup = container.querySelector('.button-group')
      const buttons = buttonGroup?.querySelectorAll('button')
      
      expect(buttons?.length).toBeGreaterThan(1)
      
      // Check for gap in button group
      const groupStyle = buttonGroup ? window.getComputedStyle(buttonGroup) : null
      expect(groupStyle?.gap).toBeTruthy()
    })
  })

  describe('Navigation button spacing', () => {
    it('should have proper spacing between Back and Next buttons', () => {
      render(
        <div className="navigation-buttons">
          <button>← Back</button>
          <button>Next →</button>
        </div>
      )

      const navButtons = container.querySelector('.navigation-buttons')
      const buttons = navButtons?.querySelectorAll('button')
      
      expect(buttons).toHaveLength(2)
      
      // Navigation buttons should be spaced apart
      const navStyle = navButtons ? window.getComputedStyle(navButtons) : null
      expect(navStyle?.justifyContent).toBe('space-between')
    })
  })

  describe('Alert and notification spacing', () => {
    it('should have proper spacing around alerts', () => {
      render(
        <div>
          <div className="alert">Alert message</div>
          <div className="content">Main content</div>
        </div>
      )

      const alert = container.querySelector('.alert')
      expect(alert).toBeInTheDocument()
      
      const alertStyle = alert ? window.getComputedStyle(alert) : null
      const marginBottom = parseInt(alertStyle?.marginBottom || '0')
      
      expect(marginBottom).toBeGreaterThan(0)
    })
  })

  describe('Modal content spacing', () => {
    it('should have proper padding in modal content', () => {
      render(
        <div className="modal-content">
          <h2>Modal Title</h2>
          <p>Modal body content</p>
          <div className="modal-footer">
            <button>Cancel</button>
            <button>Confirm</button>
          </div>
        </div>
      )

      const modalContent = container.querySelector('.modal-content')
      const modalFooter = container.querySelector('.modal-footer')
      
      expect(modalContent).toBeInTheDocument()
      expect(modalFooter).toBeInTheDocument()
      
      // Check modal content padding
      const contentStyle = modalContent ? window.getComputedStyle(modalContent) : null
      const padding = parseInt(contentStyle?.padding || '0')
      expect(padding).toBeGreaterThanOrEqual(16)
      
      // Check modal footer spacing
      const footerStyle = modalFooter ? window.getComputedStyle(modalFooter) : null
      const marginTop = parseInt(footerStyle?.marginTop || '0')
      expect(marginTop).toBeGreaterThan(0)
    })
  })
})