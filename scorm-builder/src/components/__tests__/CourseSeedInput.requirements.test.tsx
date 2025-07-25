import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseSeedInput } from '../CourseSeedInputRefactored'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

// Mocks
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn()
  }))
}))

vi.mock('../../services/FileStorage', () => ({
  fileStorage: {
    isInitialized: true,
    currentProjectId: 'test-project',
    saveProject: vi.fn().mockResolvedValue({}),
    saveContent: vi.fn().mockResolvedValue({}),
    saveCourseMetadata: vi.fn().mockResolvedValue({}),
    addStateChangeListener: vi.fn(() => () => {})
  }
}))

/**
 * Requirements-Based Tests for CourseSeedInput
 * 
 * These tests verify the component meets business requirements,
 * not just that it runs without errors.
 */

describe('CourseSeedInput - Business Requirements', () => {
  const mockHandlers = {
    onSubmit: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ success: true }),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onSettingsClick: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  const renderComponent = () => {
    return render(
      <PersistentStorageProvider>
        <StepNavigationProvider initialStep={0}>
          <CourseSeedInput {...mockHandlers} />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('REQUIREMENT: Course must have a title', () => {
    it('❌ FAILS: Should prevent navigation without a title', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Try to proceed without entering title
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // EXPECTED: Error message should be visible to user
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      })
      
      // EXPECTED: Should NOT proceed to next step
      expect(mockHandlers.onSubmit).not.toHaveBeenCalled()
      
      // BUG FOUND: Error appears briefly then disappears (toast)
      // This is poor UX - user might miss the error
    })

    it('❌ FAILS: Should show persistent validation error near the input field', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      const nextButton = screen.getByRole('button', { name: /next/i })
      
      // Try to submit empty
      await user.click(nextButton)
      
      // EXPECTED: Error should appear near the title input
      const errorNearInput = titleInput.parentElement?.querySelector('[role="alert"]')
      expect(errorNearInput).toBeInTheDocument()
      expect(errorNearInput).toHaveTextContent(/required/i)
      
      // ACTUAL: No inline error - only toast notification
      // This violates accessibility best practices
    })
  })

  describe('REQUIREMENT: Templates should provide pre-filled content', () => {
    it('❓ UNCLEAR: Should template selection auto-populate topics', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Select a template
      const buttons = screen.getAllByRole('button')
      const safetyTemplate = buttons.find(btn => btn.textContent?.includes('Safety'))
      
      if (safetyTemplate) {
        await user.click(safetyTemplate)
        
        // EXPECTED: Topics textarea should be populated with template topics
        const topicsTextarea = screen.getByPlaceholderText(/enter each topic/i)
        expect(topicsTextarea).not.toHaveValue('')
        
        // QUESTION: Should template topics be editable or read-only?
        // QUESTION: Should they merge with custom topics or replace them?
      }
    })
  })

  describe('REQUIREMENT: Auto-save should not lose user data', () => {
    it('❌ FAILS: Should handle save failures gracefully', async () => {
      const user = userEvent.setup()
      
      // Make save fail
      mockHandlers.onSave.mockRejectedValueOnce(new Error('Network error'))
      
      renderComponent()
      
      // Enter data
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Important Course Data'
      )
      
      // Trigger save
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      // EXPECTED: Error message should appear
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
      })
      
      // CRITICAL: Form data should NOT be lost
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      expect(titleInput).toHaveValue('Important Course Data')
      
      // EXPECTED: Retry option should be available
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  describe('REQUIREMENT: Accessibility compliance', () => {
    it('❌ FAILS: All form inputs should have proper labels', () => {
      renderComponent()
      
      // Check title input
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      const titleLabel = screen.getByLabelText(/course title/i)
      expect(titleLabel).toBe(titleInput) // Label should be associated
      
      // Check difficulty has accessible name
      const difficultyButtons = screen.getAllByTestId(/difficulty-\d/)
      difficultyButtons.forEach((button, index) => {
        expect(button).toHaveAccessibleName()
        // Should indicate which difficulty level this represents
        expect(button.getAttribute('aria-label')).toMatch(/difficulty.*\d/i)
      })
    })

    it('❌ FAILS: Error messages should be announced to screen readers', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Trigger validation error
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // EXPECTED: Error should have role="alert" for screen reader announcement
      const error = await screen.findByText(/title is required/i)
      expect(error).toHaveAttribute('role', 'alert')
      
      // EXPECTED: Error should be programmatically associated with input
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      expect(titleInput).toHaveAttribute('aria-invalid', 'true')
      expect(titleInput).toHaveAttribute('aria-describedby')
    })
  })

  describe('REQUIREMENT: Data persistence', () => {
    it('Should save all form fields, not just the title', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Fill out complete form
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Complete Course'
      )
      await user.click(screen.getByTestId('difficulty-5'))
      await user.type(
        screen.getByPlaceholderText(/enter each topic/i),
        'Topic 1\nTopic 2'
      )
      
      // Save
      await user.click(screen.getByRole('button', { name: /save/i }))
      
      // EXPECTED: All data should be saved
      expect(mockHandlers.onSave).toHaveBeenCalledWith({
        courseTitle: 'Complete Course',
        difficulty: 5,
        customTopics: ['Topic 1', 'Topic 2'],
        template: 'None',
        templateTopics: []
      })
      
      // QUESTION: Should we save draft state or only complete data?
    })
  })

  describe('REQUIREMENT: User feedback', () => {
    it('❌ FAILS: Should show clear feedback for all actions', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Test difficulty selection feedback
      const expertButton = screen.getByTestId('difficulty-5')
      await user.click(expertButton)
      
      // EXPECTED: Clear indication of selection
      expect(expertButton).toHaveAttribute('aria-pressed', 'true')
      expect(expertButton).toHaveAccessibleName(/selected.*expert/i)
      
      // ACTUAL: Only color change, no textual/accessible feedback
    })
  })
})