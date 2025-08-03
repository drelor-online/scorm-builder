import { vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/testProviders'

import { AIPromptGenerator } from '../AIPromptGenerator'
import type { CourseSeedData } from '../../types/course'

// Mock CoursePreview component
vi.mock('../CoursePreview', () => ({
  CoursePreview: () => (
    <button>Preview Course</button>
  )
}))

describe('AIPromptGenerator UX Fixes', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None' as const,
    templateTopics: []
  }

  const mockProps = {
    courseSeedData: mockCourseSeedData,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not have undo/redo buttons in the top bar', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    // Should not find undo/redo buttons
    expect(screen.queryByLabelText(/undo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/redo/i)).not.toBeInTheDocument()
    expect(screen.queryByText('↶')).not.toBeInTheDocument()
    expect(screen.queryByText('↷')).not.toBeInTheDocument()
  })

  it('should not have Reset button', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    // Check that Reset button is not present
    const buttons = screen.getAllByRole('button')
    const resetButton = buttons.find(btn => btn.textContent?.toLowerCase().includes('reset'))
    expect(resetButton).toBeUndefined()
  })

  it('should not have History button', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    expect(screen.queryByText(/history/i)).not.toBeInTheDocument()
  })

  it('should not have Save as Template button', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    // Check that Save as Template button is not present
    const buttons = screen.getAllByRole('button')
    const saveAsTemplateButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('save as template')
    )
    expect(saveAsTemplateButton).toBeUndefined()
  })

  it('should have CoursePreview component with correct props', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    // CoursePreview should be rendered
    expect(screen.getByText('Preview Course')).toBeInTheDocument()
  })

  it('should have Back and Next buttons', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    expect(screen.getByText('← Back')).toBeInTheDocument()
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })

  it('should display course information correctly', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('should have copy prompt button', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    expect(screen.getByText('📋 Copy Prompt')).toBeInTheDocument()
  })

  it('should display instructions section', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    expect(screen.getByText('Instructions')).toBeInTheDocument()
    expect(screen.getByText(/Copy this prompt using the button above/)).toBeInTheDocument()
    expect(screen.getByText(/Paste it into your preferred AI chatbot/)).toBeInTheDocument()
  })

  it('should use simple state management without undo/redo', () => {
    render(<AIPromptGenerator {...mockProps} />)
    
    const textarea = screen.getByLabelText(/ai prompt for course generation/i)
    
    // Should be able to edit the prompt
    expect(textarea).toBeInTheDocument()
    expect(textarea).not.toBeDisabled()
  })
})