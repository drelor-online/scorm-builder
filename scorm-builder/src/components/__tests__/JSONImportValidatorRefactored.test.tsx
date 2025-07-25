import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSONImportValidator } from '../JSONImportValidatorRefactored'

describe('JSONImportValidator with Design System', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnHelp = vi.fn()

  const validJSON = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      narration: 'Welcome narration'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      narration: 'Objectives narration'
    },
    topics: [{
      id: 'topic1',
      title: 'Topic 1',
      content: 'Topic content',
      narration: 'Topic narration'
    }],
    assessment: {
      questions: [{
        id: 'q1',
        type: 'multiple-choice',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0
      }]
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses design system components for layout', () => {
    render(
      <JSONImportValidator 
        onNext={mockOnNext}
        onBack={mockOnBack}
        onSettingsClick={mockOnSettingsClick}
        onSave={mockOnSave}
        onOpen={mockOnOpen}
        onHelp={mockOnHelp}
      />
    )

    // Check for Card component
    expect(document.querySelector('.card')).toBeInTheDocument()
    
    // Check for design system buttons (excluding header buttons from PageLayout)
    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
    expect(pasteButton).toHaveClass('btn')
    
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    expect(validateButton).toHaveClass('btn')
  })

  it('uses Input component for JSON textarea', () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    const jsonInput = screen.getByLabelText(/json input/i)
    expect(jsonInput).toHaveClass('textarea')
    expect(jsonInput.parentElement).toHaveClass('input-wrapper')
  })

  it('uses ButtonGroup for action buttons', () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    // Check for button group containing utility buttons
    const buttonGroups = document.querySelectorAll('.button-group')
    expect(buttonGroups.length).toBeGreaterThan(0)
  })

  it('uses Flex layout for button organization', () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    // Check for flex containers
    const flexContainers = document.querySelectorAll('.flex')
    expect(flexContainers.length).toBeGreaterThan(0)
  })

  it('displays validation results using Alert component', async () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    // Enter invalid JSON
    const jsonInput = screen.getByLabelText(/json input/i)
    fireEvent.change(jsonInput, { target: { value: 'invalid json' } })
    
    // Validate
    fireEvent.click(screen.getByRole('button', { name: /validate json/i }))
    
    await waitFor(() => {
      const alert = document.querySelector('.alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveClass('alert-error')
    })
  })

  it('displays success validation using Alert component', async () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    // Enter valid JSON
    const jsonInput = screen.getByLabelText(/json input/i)
    fireEvent.change(jsonInput, { target: { value: JSON.stringify(validJSON) } })
    
    // Validate
    fireEvent.click(screen.getByRole('button', { name: /validate json/i }))
    
    await waitFor(() => {
      const alert = document.querySelector('.alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveClass('alert-success')
    })
  })

  it('uses consistent button styling throughout', () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
    expect(pasteButton).toHaveClass('btn', 'btn-secondary')
    
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    expect(validateButton).toHaveClass('btn', 'btn-primary')
    
    const backButton = screen.getByRole('button', { name: /back/i })
    expect(backButton).toHaveClass('btn', 'btn-secondary')
    
    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toHaveClass('btn', 'btn-primary', 'btn-large')
  })

  it('uses Section component for proper spacing', () => {
    const { container } = render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    const sections = container.querySelectorAll('.section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('maintains all functionality with design system', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        readText: vi.fn().mockResolvedValue(JSON.stringify(validJSON))
      }
    })

    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    // Test paste functionality
    fireEvent.click(screen.getByRole('button', { name: /paste from clipboard/i }))
    
    await waitFor(() => {
      const jsonInput = screen.getByLabelText(/json input/i)
      expect(jsonInput).toHaveValue(JSON.stringify(validJSON))
    })
    
    // Validate
    fireEvent.click(screen.getByRole('button', { name: /validate json/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
    })
    
    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    
    expect(mockOnNext).toHaveBeenCalledWith(validJSON)
  })

  it('handles file upload with design system', () => {
    render(<JSONImportValidator onNext={mockOnNext} onBack={mockOnBack} />)
    
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveStyle({ display: 'none' }) // Hidden but functional
    
    // The label acts as the button
    const fileButton = screen.getByText(/choose file/i).closest('label')
    expect(fileButton).toHaveClass('btn', 'btn-secondary')
  })
})