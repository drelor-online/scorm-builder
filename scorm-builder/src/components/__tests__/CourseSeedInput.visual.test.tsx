import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/testProviders'
import { CourseSeedInput } from '../CourseSeedInput'
import './setupCourseSeedTests'

describe('CourseSeedInput Visual Enhancements', () => {
  const mockProps = {
    onSubmit: () => {},
    onSettingsClick: () => {},
    onSave: () => {},
    onOpen: () => {},
    onHelp: () => {},
    onStepClick: () => {}
  }

  it('should have consistent spacing between form sections', () => {
    render(<CourseSeedInput {...mockProps} />)
    const sections = container.querySelectorAll('.section')
    
    sections.forEach(section => {
      const styles = window.getComputedStyle(section)
      expect(styles.marginBottom).toBe('32px')
    })
  })

  it('should have visual focus indicators on inputs', () => {
    render(<CourseSeedInput {...mockProps} />)
    const input = screen.getByLabelText(/Course Title/i)
    
    input.focus()
    const styles = window.getComputedStyle(input)
    expect(styles.borderColor).toBe('rgb(59, 130, 246)') // primary color
    expect(styles.boxShadow).toMatch(/rgba/)
  })

  it('should have consistent card styling for form groups', () => {
    render(<CourseSeedInput {...mockProps} />)
    const cards = container.querySelectorAll('.card')
    
    cards.forEach(card => {
      const styles = window.getComputedStyle(card)
      expect(styles.boxShadow).toMatch(/rgba/)
      expect(styles.borderRadius).toBe('12px')
    })
  })

  it('should show character count for course title', () => {
    render(<CourseSeedInput {...mockProps} />)
    const charCount = screen.getByText(/0\/100 characters/i)
    expect(charCount).toBeInTheDocument()
  })

  it('should have visual indicators for difficulty levels', () => {
    render(<CourseSeedInput {...mockProps} />)
    const difficultyButtons = container.querySelectorAll('[data-testid^="difficulty-"]')
    
    // Should have 5 difficulty levels
    expect(difficultyButtons.length).toBeGreaterThanOrEqual(5)
    
    // Check first 5 buttons
    Array.from(difficultyButtons).slice(0, 5).forEach((button, index) => {
      expect(button.getAttribute('aria-label')).toBe(`Level ${index + 1}`)
    })
  })

  it('should have helper text under important fields', () => {
    render(<CourseSeedInput {...mockProps} />)
    
    // Check for helper text
    expect(screen.getByText(/Enter a descriptive title for your course/i)).toBeInTheDocument()
    expect(screen.getByText(/Select the complexity level for your learners/i)).toBeInTheDocument()
  })

  it('should have improved button hierarchy', () => {
    render(<CourseSeedInput {...mockProps} />)
    
    const primaryButton = screen.getByText(/Continue to AI Prompt/i)
    const allButtons = screen.getAllByRole('button')
    
    // Primary button should be more prominent
    expect(primaryButton.classList.contains('btn-primary')).toBe(true)
    expect(primaryButton.classList.contains('btn-large')).toBe(true)
    
    // Count non-primary buttons (excluding difficulty buttons which may be primary when selected)
    const nonPrimaryButtons = allButtons.filter(btn => 
      btn.textContent !== 'Continue to AI Prompt' && 
      !btn.getAttribute('data-testid')?.includes('difficulty')
    )
    
    // At least some buttons should be secondary
    const hasSecondaryButtons = nonPrimaryButtons.some(btn => 
      btn.classList.contains('btn-secondary') || 
      btn.classList.contains('btn-tertiary')
    )
    expect(hasSecondaryButtons).toBe(true)
  })

  it('should have progress indicator showing form completion', () => {
    render(<CourseSeedInput {...mockProps} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar.getAttribute('aria-label')).toBe('Form completion')
  })
})