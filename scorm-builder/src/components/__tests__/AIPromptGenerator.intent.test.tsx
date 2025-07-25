import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIPromptGenerator } from '../AIPromptGenerator'

// Mock only what's necessary
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

// Mock Toast component
vi.mock('../Toast', () => ({
  Toast: ({ message }: any) => <div role="alert">{message}</div>
}))

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn()
}
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true
})

describe('AIPromptGenerator - User Intent Tests', () => {
  const mockCourseSeedData = {
    courseTitle: 'JavaScript Fundamentals',
    difficulty: 3,
    customTopics: ['Variables', 'Functions', 'Arrays', 'Objects', 'Promises'],
    template: 'Technical' as const,
    templateTopics: []
  }

  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('User wants to generate an AI prompt', () => {
    it('should display course information', () => {
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Should show course details
      expect(screen.getByText('JavaScript Fundamentals')).toBeInTheDocument()
      expect(screen.getByText('3/5')).toBeInTheDocument()
      expect(screen.getByText('Technical')).toBeInTheDocument()
    })

    it('should generate detailed prompt with all course elements', () => {
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      const promptText = promptTextarea.value
      
      // Should include course details
      expect(promptText).toContain('Title: JavaScript Fundamentals')
      expect(promptText).toContain('Difficulty Level: 3/5')
      expect(promptText).toContain('Template: Technical')
      
      // Should include topics
      mockCourseSeedData.customTopics.forEach(topic => {
        expect(promptText).toContain(`- ${topic}`)
      })
      
      // Should include course structure elements
      expect(promptText).toContain('welcomePage')
      expect(promptText).toContain('learningObjectivesPage')
      expect(promptText).toContain('topics')
      expect(promptText).toContain('assessment')
    })
  })

  describe('User wants to copy the prompt', () => {
    it('should copy prompt to clipboard when button clicked', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      // Find copy button by its text content
      const copyButton = screen.getByText(/copy prompt/i)
      
      // Verify clipboard hasn't been called yet
      expect(mockClipboard.writeText).not.toHaveBeenCalled()
      
      // Click the button
      fireEvent.click(copyButton)

      // Run timers since the component uses setTimeout
      await vi.runAllTimersAsync()
      
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1)
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('JavaScript Fundamentals')
      )
    })

    it.skip('should show feedback when prompt is copied', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const copyButton = screen.getByText(/copy prompt/i)
      fireEvent.click(copyButton)

      // The button should immediately change
      expect(screen.getByText('✓ Copied!')).toBeInTheDocument()
      
      // The toast should also appear
      expect(screen.getByRole('alert')).toHaveTextContent('Copied to clipboard!')
    })

    it('should handle copy errors gracefully', async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Copy failed'))
      
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const copyButton = screen.getByText(/copy prompt/i)
      fireEvent.click(copyButton)

      await vi.runAllTimersAsync()
      
      expect(screen.getByText('Failed to copy to clipboard. Please try selecting and copying manually.')).toBeInTheDocument()
    })
  })

  describe('User wants to navigate through wizard', () => {
    it('should navigate to next step', () => {
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const nextButton = screen.getByText('Next →')
      fireEvent.click(nextButton)

      expect(mockOnNext).toHaveBeenCalled()
    })

    it('should navigate back to previous step', () => {
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const backButton = screen.getByText('← Back')
      fireEvent.click(backButton)

      expect(mockOnBack).toHaveBeenCalled()
    })
  })

  describe('User wants to see instructions', () => {
    it('should display clear instructions for using the prompt', () => {
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('Instructions')).toBeInTheDocument()
      expect(screen.getByText('Copy this prompt using the button above')).toBeInTheDocument()
      expect(screen.getByText('Paste it into your preferred AI chatbot (ChatGPT, Claude, etc.)')).toBeInTheDocument()
      expect(screen.getByText('Copy the JSON response from the AI')).toBeInTheDocument()
      expect(screen.getByText('Click Next to proceed to the JSON import step')).toBeInTheDocument()
    })
  })

  describe('User wants to customize the prompt', () => {
    it('should allow editing the generated prompt', () => {
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      
      // Change the value
      fireEvent.change(promptTextarea, { target: { value: 'My custom prompt' } })

      expect(promptTextarea.value).toBe('My custom prompt')
    })

    it('should copy custom prompt when edited', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
      fireEvent.change(promptTextarea, { target: { value: 'Custom prompt text' } })

      const copyButton = screen.getByText(/copy prompt/i)
      fireEvent.click(copyButton)

      await vi.runAllTimersAsync()
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith('Custom prompt text')
    })
  })

  describe('User wants accessibility features', () => {
    it.skip('should announce copy status to screen readers', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined)
      
      render(
        <AIPromptGenerator
          courseSeedData={mockCourseSeedData}
          onNext={mockOnNext}
          onBack={mockOnBack}
        />
      )

      const copyButton = screen.getByText(/copy prompt/i)
      fireEvent.click(copyButton)

      // Status should be announced immediately
      const statusElements = screen.getAllByRole('status')
      const copiedStatus = statusElements.find(el => 
        el.textContent === 'Prompt copied to clipboard'
      )
      expect(copiedStatus).toBeTruthy()
    })
  })
})