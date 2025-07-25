import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AIPromptGenerator } from '../../../components/AIPromptGenerator'
import { CourseSeedData } from '../../../types/course'

// Mock Toast component
vi.mock('../../../components/Toast', () => ({
  Toast: ({ message, type }: { message: string; type: string }) => (
    <div role="alert" data-type={type}>{message}</div>
  )
}))

// Mock CoursePreview component
vi.mock('../../../components/CoursePreview', () => ({
  CoursePreview: () => <div data-testid="course-preview">Course Preview</div>
}))

// Mock AutoSaveIndicatorConnected
vi.mock('../../../components/AutoSaveIndicatorConnected', () => ({
  AutoSaveIndicatorConnected: () => <div data-testid="autosave-indicator">AutoSave</div>
}))

// Mock useFormChanges hook
vi.mock('../../../hooks/useFormChanges', () => ({
  useFormChanges: () => ({
    attemptNavigation: (fn: () => void) => fn(),
    checkForChanges: vi.fn()
  })
}))

// Mock PageLayout to render children
vi.mock('../../../components/PageLayout', () => ({
  PageLayout: ({ children, title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
  FormSection: ({ children, title }: any) => (
    <section>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}))

describe('AI Prompt Generator Page Behavior', () => {
  const mockWriteText = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
    
    // Mock the clipboard API
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: mockWriteText
      },
      writable: true,
      configurable: true
    })
  })
  
  afterEach(() => {
    // Clean up
    if ('clipboard' in window.navigator) {
      delete (window.navigator as any).clipboard
    }
  })
  
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    template: 'Corporate',
    customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
    templateTopics: []
  }
  
  const mockHandlers = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }


  it('should display basic course information from seed data', () => {
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Check title and description
    expect(screen.getByText('AI Prompt Generator')).toBeInTheDocument()
    expect(screen.getByText('Generate a comprehensive AI prompt based on your course configuration')).toBeInTheDocument()

    // Check course information section
    expect(screen.getByText('Course Information')).toBeInTheDocument()
    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
    expect(screen.getByText('Corporate')).toBeInTheDocument()
  })

  it('should generate appropriate prompt based on course seed data', () => {
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Find the prompt textarea
    const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
    
    // Check that prompt contains course information
    expect(promptTextarea.value).toContain('Title: Test Course')
    expect(promptTextarea.value).toContain('Difficulty Level: 3/5')
    expect(promptTextarea.value).toContain('Template: Corporate')
    
    // Check that prompt contains topics
    expect(promptTextarea.value).toContain('- Topic 1')
    expect(promptTextarea.value).toContain('- Topic 2')
    expect(promptTextarea.value).toContain('- Topic 3')
    
    // Check for JSON structure instructions
    expect(promptTextarea.value).toContain('welcomePage')
    expect(promptTextarea.value).toContain('learningObjectivesPage')
    expect(promptTextarea.value).toContain('topics')
    expect(promptTextarea.value).toContain('assessment')
  })

  it('should have copy button that copies prompt to clipboard', async () => {
    const user = userEvent.setup()
    
    // Ensure our mock is still in place
    window.navigator.clipboard.writeText = mockWriteText
    
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Find copy button
    const copyButton = screen.getByRole('button', { name: /copy prompt/i })
    expect(copyButton).toBeInTheDocument()
    
    // Click copy button
    await user.click(copyButton)
    
    // Wait for async operation
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1)
    })
    
    const copiedText = mockWriteText.mock.calls[0][0]
    expect(copiedText).toContain('Title: Test Course')
    expect(copiedText).toContain('- Topic 1')
  })

  it('should provide feedback when prompt is copied to clipboard', async () => {
    const user = userEvent.setup()
    
    // Ensure our mock is still in place
    window.navigator.clipboard.writeText = mockWriteText
    
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const copyButton = screen.getByRole('button', { name: /copy prompt/i })
    
    // Click copy button
    await user.click(copyButton)
    
    // Check for success feedback
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Copied to clipboard!')
      expect(screen.getByRole('alert')).toHaveAttribute('data-type', 'success')
    })
    
    // Check button text changes to show copied state
    expect(screen.getByText('✓ Copied!')).toBeInTheDocument()
    
    // Check for screen reader announcement
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Prompt copied to clipboard')
  })

  it('should handle clipboard errors gracefully', async () => {
    const user = userEvent.setup()
    // Reset mock and set up rejection
    mockWriteText.mockReset()
    mockWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'))
    
    // Ensure our mock is still in place
    window.navigator.clipboard.writeText = mockWriteText
    
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const copyButton = screen.getByRole('button', { name: /copy prompt/i })
    
    // Click copy button
    await user.click(copyButton)
    
    // Check for error feedback
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy to clipboard. Please try selecting and copying manually.')
      expect(screen.getByRole('alert')).toHaveAttribute('data-type', 'error')
    })
    
    // Button should not show copied state
    expect(screen.queryByText('✓ Copied!')).not.toBeInTheDocument()
  })

  it('should allow custom editing of the prompt', async () => {
    const user = userEvent.setup()
    
    // Ensure our mock is still in place
    window.navigator.clipboard.writeText = mockWriteText
    
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
    const originalPrompt = promptTextarea.value
    
    // Type additional text to the prompt (instead of clearing)
    await user.click(promptTextarea)
    await user.keyboard('{End}')
    await user.type(promptTextarea, '\n\nADDITIONAL CUSTOM INSTRUCTIONS')
    
    // Verify the text was added
    expect(promptTextarea.value).toContain('ADDITIONAL CUSTOM INSTRUCTIONS')
    expect(promptTextarea.value).toContain(originalPrompt)
    
    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy prompt/i })
    await user.click(copyButton)
    
    // Wait for the copy operation
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1)
    })
    
    // Verify modified prompt was copied
    const copiedText = mockWriteText.mock.calls[0][0]
    expect(copiedText).toContain('ADDITIONAL CUSTOM INSTRUCTIONS')
    expect(copiedText).toContain('Title: Test Course')
  })

  it('should display clear instructions for using the prompt', () => {
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Check for instructions section
    expect(screen.getByText('Instructions')).toBeInTheDocument()
    
    // Check for step-by-step instructions
    expect(screen.getByText(/Copy this prompt using the button above/i)).toBeInTheDocument()
    expect(screen.getByText(/Paste it into your preferred AI chatbot/i)).toBeInTheDocument()
    expect(screen.getByText(/Copy the JSON response from the AI/i)).toBeInTheDocument()
    expect(screen.getByText(/Click Next to proceed to the JSON import step/i)).toBeInTheDocument()
  })

  it('should handle empty topics gracefully', () => {
    const emptySeedData: CourseSeedData = {
      ...mockCourseSeedData,
      customTopics: []
    }
    
    render(
      <AIPromptGenerator
        courseSeedData={emptySeedData}
        {...mockHandlers}
      />
    )

    const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
    
    // Should show default topics when no custom topics provided
    expect(promptTextarea.value).toContain('- Introduction')
    expect(promptTextarea.value).toContain('- Main Content')
    expect(promptTextarea.value).toContain('- Summary')
  })

  it('should include specific instructions for AI in the prompt', () => {
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    const promptTextarea = screen.getByLabelText('AI prompt for course generation') as HTMLTextAreaElement
    
    // Check for important instructions
    expect(promptTextarea.value).toContain('Always include Welcome and Learning Objectives pages')
    expect(promptTextarea.value).toContain('NO knowledge check for Welcome page or Learning Objectives page')
    expect(promptTextarea.value).toContain('Content must be provided as an HTML fragment')
    expect(promptTextarea.value).toContain('Each page should have exactly ONE narration')
    expect(promptTextarea.value).toContain('Assessment page should have NO narration')
    expect(promptTextarea.value).toContain('Include at least 10 questions in the final assessment')
  })
})