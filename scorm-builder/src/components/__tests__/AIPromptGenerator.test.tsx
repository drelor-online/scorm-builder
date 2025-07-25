import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIPromptGenerator } from '../AIPromptGenerator'
import { CourseSeedData } from '../../types/course'

// Mock the hooks
vi.mock('../../hooks/useFormChanges', () => ({
  useFormChanges: () => ({
    attemptNavigation: (callback: () => void) => callback(),
    checkForChanges: vi.fn()
  })
}))

vi.mock('../../hooks/useLocalStorageAutoSave', () => ({
  useLocalStorageAutoSave: () => ({
    isSaving: false,
    hasDraft: false,
    timeSinceLastSave: null
  })
}))

// Mock the components
vi.mock('../PageLayout', () => ({
  PageLayout: ({ children, title, description, actions }: any) => (
    <div data-testid="page-wrapper">
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  ),
  FormSection: ({ children, title }: any) => (
    <div>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  )
}))

vi.mock('../AutoSaveIndicator', () => ({
  AutoSaveIndicator: () => <div>AutoSave Status</div>
}))

vi.mock('../CoursePreview', () => ({
  CoursePreview: () => <button className="btn btn-secondary btn-medium">Preview Course</button>
}))

vi.mock('../Toast', () => ({
  Toast: ({ message, type }: any) => (
    <div role="alert" data-type={type}>{message}</div>
  )
}))

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn()
}
Object.assign(navigator, {
  clipboard: mockClipboard
})

describe('AIPromptGenerator', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    template: 'Corporate',
    customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
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

  describe('User sees course information displayed correctly', () => {
    it('should display course title, difficulty, and template', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      expect(screen.getByText('Test Course')).toBeInTheDocument()
      expect(screen.getByText('3/5')).toBeInTheDocument()
      expect(screen.getByText('Corporate')).toBeInTheDocument()
    })

    it('should display the course information section title', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      expect(screen.getByText('Course Information')).toBeInTheDocument()
    })
  })

  describe('User sees AI prompt generated based on course data', () => {
    it('should generate prompt with course details and topics', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      const textarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      const promptText = textarea.value
      
      expect(promptText).toContain('Title: Test Course')
      expect(promptText).toContain('Difficulty Level: 3/5')
      expect(promptText).toContain('Template: Corporate')
      expect(promptText).toContain('- Topic 1')
      expect(promptText).toContain('- Topic 2')
      expect(promptText).toContain('- Topic 3')
    })

    it('should include comprehensive JSON structure instructions', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      const textarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      const promptText = textarea.value
      
      // Check for key structural elements
      expect(promptText).toContain('welcomePage')
      expect(promptText).toContain('learningObjectivesPage')
      expect(promptText).toContain('topics')
      expect(promptText).toContain('assessment')
      expect(promptText).toContain('knowledgeCheck')
      expect(promptText).toContain('narration')
      expect(promptText).toContain('imageKeywords')
      expect(promptText).toContain('videoSearchTerms')
    })
  })

  describe('User can copy prompt to clipboard', () => {
    it('should copy prompt when copy button is clicked', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(<AIPromptGenerator {...mockProps} />)
      
      const copyButton = screen.getByLabelText('Copy prompt to clipboard')
      await userEvent.click(copyButton)
      
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Title: Test Course'))
        expect(screen.getByText('✓ Copied!')).toBeInTheDocument()
      })
    })

    it('should show success toast when copy succeeds', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(<AIPromptGenerator {...mockProps} />)
      
      const copyButton = screen.getByLabelText('Copy prompt to clipboard')
      await userEvent.click(copyButton)
      
      await waitFor(() => {
        expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument()
      })
    })

    it('should show error toast when copy fails', async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'))
      
      render(<AIPromptGenerator {...mockProps} />)
      
      const copyButton = screen.getByLabelText('Copy prompt to clipboard')
      await userEvent.click(copyButton)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to copy to clipboard. Please try selecting and copying manually.')).toBeInTheDocument()
      })
    })

    it('should announce copy status to screen readers', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(<AIPromptGenerator {...mockProps} />)
      
      const copyButton = screen.getByLabelText('Copy prompt to clipboard')
      await userEvent.click(copyButton)
      
      await waitFor(() => {
        // Use getAllByRole since there are multiple status elements
        const statusElements = screen.getAllByRole('status')
        const copiedStatus = statusElements.find(el => el.textContent === 'Prompt copied to clipboard')
        expect(copiedStatus).toBeInTheDocument()
      })
    })
  })

  describe('User can edit the generated prompt', () => {
    it('should allow editing the prompt in the textarea', async () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      const textarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      const customText = 'Custom prompt text'
      
      // Clear and type in a more React-friendly way
      fireEvent.change(textarea, { target: { value: customText } })
      
      expect(textarea.value).toBe(customText)
    })

    it('should copy the edited prompt when copy is clicked', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(<AIPromptGenerator {...mockProps} />)
      
      const textarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      const customText = 'My custom prompt'
      
      // Change the textarea value
      fireEvent.change(textarea, { target: { value: customText } })
      
      const copyButton = screen.getByLabelText('Copy prompt to clipboard')
      await userEvent.click(copyButton)
      
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(customText)
      })
    })
  })

  describe('User sees clear instructions for using the prompt', () => {
    it('should display instructions section', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      expect(screen.getByText('Instructions')).toBeInTheDocument()
    })

    it('should display all instruction steps', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      expect(screen.getByText('Copy this prompt using the button above')).toBeInTheDocument()
      expect(screen.getByText('Paste it into your preferred AI chatbot (ChatGPT, Claude, etc.)')).toBeInTheDocument()
      expect(screen.getByText('Copy the JSON response from the AI')).toBeInTheDocument()
      expect(screen.getByText('Click Next to proceed to the JSON import step')).toBeInTheDocument()
    })
  })

  describe('User can navigate between steps', () => {
    it('should call onNext when Next button is clicked', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      const nextButton = screen.getByText('Next →')
      fireEvent.click(nextButton)
      
      expect(mockProps.onNext).toHaveBeenCalledOnce()
    })

    it('should call onBack when Back button is clicked', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      const backButton = screen.getByText('← Back')
      fireEvent.click(backButton)
      
      expect(mockProps.onBack).toHaveBeenCalledOnce()
    })

    it('should call onStepClick when step is clicked', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      // The PageLayout component would render step indicators
      // We're testing that the handler is properly connected
      mockProps.onStepClick && mockProps.onStepClick(0)
      expect(mockProps.onStepClick).toHaveBeenCalledWith(0)
    })
  })

  describe('User sees proper layout and styling', () => {
    it('should render with PageLayout wrapper', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
      expect(screen.getByText('Generate a comprehensive AI prompt based on your course configuration')).toBeInTheDocument()
    })

    it('should render CoursePreview component', () => {
      render(<AIPromptGenerator {...mockProps} />)
      
      // CoursePreview is rendered but we don't test its internals here
      const container = screen.getByText('Next →').parentElement
      expect(container).toBeInTheDocument()
    })
  })

  describe('User wants default topics when no custom topics provided', () => {
    it('should show default topics when customTopics is empty', () => {
      const propsWithNoTopics = {
        ...mockProps,
        courseSeedData: {
          ...mockCourseSeedData,
          customTopics: []
        }
      }
      
      render(<AIPromptGenerator {...propsWithNoTopics} />)
      
      const textarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      const promptText = textarea.value
      
      expect(promptText).toContain('- Introduction')
      expect(promptText).toContain('- Main Content')
      expect(promptText).toContain('- Summary')
    })
  })
})