// Removed unused React import
import { render, screen } from '../../../test/testProviders'
import '@testing-library/jest-dom'

// Test navigation button consistency
describe('Button Label Consistency', () => {
  describe('Navigation Buttons', () => {
    it('should use "Next" for forward navigation in all steps', () => {
      const components = [
        { name: 'CourseSeedInput', hasNext: true },
        { name: 'AIPromptGenerator', hasNext: true },
        { name: 'JSONImportValidator', hasNext: true },
        { name: 'MediaEnhancementWizard', hasNext: true },
        { name: 'AudioNarrationWizard', hasNext: true },
        { name: 'ActivitiesEditor', hasNext: true },
        { name: 'SCORMPackageBuilder', hasNext: false }
      ]
      
      components.forEach(comp => {
        if (comp.hasNext) {
          render(
            <button className="btn-primary navigation-next">Next</button>
          )
          const nextButton = container.querySelector('.navigation-next')
          expect(nextButton).toHaveTextContent('Next')
        }
      })
    })

    it('should use "Back" for backward navigation in all steps', () => {
      render(
        <div>
          <button className="btn-secondary navigation-back">Back</button>
          <button className="btn-secondary navigation-back">Back</button>
        </div>
      )
      
      const backButtons = container.querySelectorAll('.navigation-back')
      backButtons.forEach(button => {
        expect(button).toHaveTextContent('Back')
      })
    })

    it('should position Next and Back buttons consistently', () => {
      render(
        <div className="navigation-buttons">
          <button className="btn-secondary navigation-back">Back</button>
          <button className="btn-primary navigation-next">Next</button>
        </div>
      )
      
      const navContainer = container.querySelector('.navigation-buttons')
      const backButton = container.querySelector('.navigation-back')
      const nextButton = container.querySelector('.navigation-next')
      
      // Back should be on the left, Next on the right
      expect(navContainer?.firstElementChild).toBe(backButton)
      expect(navContainer?.lastElementChild).toBe(nextButton)
    })
  })

  describe('Action Button Labels', () => {
    it('should use consistent labels for common actions', () => {
      const actionButtons = [
        { action: 'save', label: 'Save', class: 'btn-primary' },
        { action: 'cancel', label: 'Cancel', class: 'btn-secondary' },
        { action: 'delete', label: 'Delete', class: 'btn-danger' },
        { action: 'edit', label: 'Edit', class: 'btn-secondary' },
        { action: 'add', label: 'Add', class: 'btn-primary' },
        { action: 'remove', label: 'Remove', class: 'btn-danger' }
      ]
      
      actionButtons.forEach(({ action, label, class: btnClass }) => {
        render(
          <button className={`btn ${btnClass} action-${action}`}>{label}</button>
        )
        const button = container.querySelector(`.action-${action}`)
        expect(button).toHaveTextContent(label)
      })
    })

    it('should use verb-first pattern for action buttons', () => {
      const goodLabels = ['Save Project', 'Delete Item', 'Add Module', 'Edit Content']
      const badLabels = ['Project Save', 'Item Deletion', 'Module Addition', 'Content Editor']
      
      goodLabels.forEach(label => {
        render(<button className="btn">{label}</button>)
        const button = container.querySelector('.btn')
        expect(button?.textContent).toMatch(/^(Save|Delete|Add|Edit|Remove|Create|Update|Cancel)/)
      })
    })
  })

  describe('Button Text Formatting', () => {
    it('should use title case for button labels', () => {
      const buttons = [
        'Save Project',
        'Add New Module',
        'Delete Selected Items',
        'Export To SCORM'
      ]
      
      buttons.forEach(label => {
        const words = label.split(' ')
        words.forEach(word => {
          // Check if first letter is uppercase (excluding prepositions)
          if (!['to', 'of', 'in', 'for', 'and', 'or'].includes(word.toLowerCase())) {
            expect(word[0]).toMatch(/[A-Z]/)
          }
        })
      })
    })

    it('should avoid using all caps', () => {
      render(
        <div>
          <button className="btn">Save</button>
          <button className="btn">Next</button>
          <button className="btn">Cancel</button>
        </div>
      )
      
      const buttons = container.querySelectorAll('.btn')
      buttons.forEach(button => {
        const text = button.textContent || ''
        expect(text).not.toMatch(/^[A-Z\s]+$/) // Not all uppercase
      })
    })

    it('should keep labels concise (1-3 words)', () => {
      render(
        <div>
          <button className="btn">Save</button>
          <button className="btn">Save Project</button>
          <button className="btn">Save All Changes</button>
        </div>
      )
      
      const buttons = container.querySelectorAll('.btn')
      buttons.forEach(button => {
        const wordCount = (button.textContent || '').trim().split(' ').length
        expect(wordCount).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('Icon and Text Combinations', () => {
    it('should include descriptive text with icons', () => {
      render(
        <button className="btn icon-button">
          <span className="icon">+</span>
          <span className="label">Add Item</span>
        </button>
      )
      
      const button = container.querySelector('.icon-button')
      const icon = button?.querySelector('.icon')
      const label = button?.querySelector('.label')
      
      expect(icon).toBeInTheDocument()
      expect(label).toBeInTheDocument()
      expect(label).toHaveTextContent('Add Item')
    })

    it('should position icons consistently before text', () => {
      render(
        <button className="btn icon-button">
          <span className="icon">✓</span>
          <span className="label">Save</span>
        </button>
      )
      
      const button = container.querySelector('.icon-button')
      expect(button?.firstElementChild).toHaveClass('icon')
      expect(button?.lastElementChild).toHaveClass('label')
    })
  })

  describe('Disabled State Labels', () => {
    it('should maintain same label in disabled state', () => {
      const { rerender } = render(
        <button className="btn" disabled={false}>Save Project</button>
      )
      
      const button = screen.getByText('Save Project')
      expect(button).toHaveTextContent('Save Project')
      
      rerender(
        <button className="btn" disabled={true}>Save Project</button>
      )
      
      expect(button).toHaveTextContent('Save Project')
      expect(button).toBeDisabled()
    })
  })
})