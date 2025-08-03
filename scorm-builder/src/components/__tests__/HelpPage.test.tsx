import { render, screen } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HelpPage } from '../HelpPage'

describe('HelpPage with Design System', () => {
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses design system components for layout', () => {
    render(<HelpPage onBack={mockOnBack} />)

    // Check for PageContainer
    const pageContainer = document.querySelector('.page-container')
    expect(pageContainer).toBeInTheDocument()
    
    // Check for Card components
    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('uses Button component for back navigation', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const backButton = screen.getByRole('button', { name: /back to course builder/i })
    expect(backButton).toHaveClass('btn')
    expect(backButton).toHaveClass('btn-tertiary')
  })

  it('displays help sections as collapsible cards', () => {
    render(<HelpPage onBack={mockOnBack} />)

    // Should have help sections
    const sectionCards = screen.getAllByTestId('help-section-card')
    expect(sectionCards.length).toBeGreaterThan(0)
    
    // Each should be a card
    sectionCards.forEach(card => {
      expect(card).toHaveClass('card')
    })
  })

  it('toggles section visibility when clicked', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const firstSectionButton = screen.getAllByTestId('section-button')[0]
    
    // Initially collapsed
    expect(firstSectionButton.textContent).toContain('+')
    
    // Click to expand
    fireEvent.click(firstSectionButton)
    expect(firstSectionButton.textContent).toContain('−')
    
    // Click to collapse
    fireEvent.click(firstSectionButton)
    expect(firstSectionButton.textContent).toContain('+')
  })

  it('uses Alert component for tips section', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const tipsSection = screen.getByText(/tips for success/i)
    const alertElement = tipsSection.closest('.alert')
    expect(alertElement).toBeInTheDocument()
    expect(alertElement).toHaveClass('alert-info')
  })

  it('displays all required help sections', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const requiredSections = [
      'Step 1: Course Configuration',
      'Step 2: AI Prompt Generator',
      'Step 3: JSON Import & Validation',
      'Step 4: Media Enhancement',
      'Step 5: Audio Narration Wizard',
      'Step 6: Questions & Assessment Editor',
      'Step 7: SCORM Package Builder'
    ]

    requiredSections.forEach(section => {
      expect(screen.getByText(section)).toBeInTheDocument()
    })
  })

  it('uses consistent typography with design system', () => {
    render(<HelpPage onBack={mockOnBack} />)

    // Main title
    const mainTitle = screen.getByText('SCORM Course Builder Help')
    expect(mainTitle.tagName.toLowerCase()).toBe('h1')
    
    // Section titles
    const sectionTitles = screen.getAllByTestId('section-title')
    sectionTitles.forEach(title => {
      expect(title.tagName.toLowerCase()).toBe('h2')
    })
  })

  it('calls onBack when back button is clicked', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const backButton = screen.getByRole('button', { name: /back to course builder/i })
    fireEvent.click(backButton)

    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('displays expanded content with proper formatting', () => {
    render(<HelpPage onBack={mockOnBack} />)

    // Expand first section
    const firstSectionButton = screen.getAllByTestId('section-button')[0]
    fireEvent.click(firstSectionButton)

    // Check for list items in expanded content
    const listItems = screen.getAllByRole('listitem')
    expect(listItems.length).toBeGreaterThan(0)
  })

  it('uses Section components for spacing', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const sections = container.querySelectorAll('.section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('renders without onBack prop', () => {
    render(<HelpPage />)

    // Should not show back button
    const backButton = screen.queryByRole('button', { name: /back to course builder/i })
    expect(backButton).not.toBeInTheDocument()
  })

  it('maintains state of multiple expanded sections', () => {
    render(<HelpPage onBack={mockOnBack} />)

    const sectionButtons = screen.getAllByTestId('section-button')
    
    // Expand first two sections
    fireEvent.click(sectionButtons[0])
    fireEvent.click(sectionButtons[1])
    
    // Both should be expanded
    expect(sectionButtons[0].textContent).toContain('−')
    expect(sectionButtons[1].textContent).toContain('−')
    
    // Collapse first, second should remain expanded
    fireEvent.click(sectionButtons[0])
    expect(sectionButtons[0].textContent).toContain('+')
    expect(sectionButtons[1].textContent).toContain('−')
  })
})