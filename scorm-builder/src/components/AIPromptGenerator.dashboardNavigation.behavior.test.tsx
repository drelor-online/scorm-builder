/**
 * Behavior Test: AIPromptGenerator - Dashboard Navigation Blocking Issue
 *
 * Tests that reproduce the exact issue reported by the beta tester where
 * dashboard navigation gets blocked after copying the prompt but no dialog
 * appears to handle the navigation warning.
 */

import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AIPromptGenerator } from './AIPromptGenerator'
import { CourseSeedData } from '../types/schema'

import { vi } from 'vitest'

// Mock notifications
const mockSuccess = vi.fn()
vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNotifications: () => ({
      success: mockSuccess,
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    })
  }
})

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

// Mock storage
const mockStorage = {
  saveContent: vi.fn().mockResolvedValue(undefined),
  getContent: vi.fn().mockResolvedValue(null),
  currentProjectId: 'test-project-123'
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

describe('AIPromptGenerator - Dashboard Navigation Blocking Issue', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None',
    templateTopics: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show navigation warning dialog after copying prompt and attempting navigation', async () => {
    const user = userEvent.setup()
    const mockOnOpen = vi.fn() // This simulates going back to dashboard

    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={mockOnOpen}
        onStepClick={vi.fn()}
      />
    )

    // **STEP 1: Copy the prompt (this triggers useFormChanges to track changes)**
    const copyButton = screen.getByTestId('copy-prompt-button-top')
    await user.click(copyButton)

    // Verify copy was successful
    expect(mockSuccess).toHaveBeenCalledWith('Copied to clipboard!')

    // **STEP 2: Try to navigate back to dashboard via Exit button**
    // The PageLayout has an "Exit to Dashboard" button that should trigger onOpen
    const exitButton = screen.getByTestId('exit-button')
    await user.click(exitButton)

    // **STEP 3: Verify navigation warning dialog appears**
    // With the fix: A dialog should appear when navigation is attempted

    await waitFor(() => {
      // Check if navigation warning dialog is shown
      const warningDialog = screen.queryByRole('dialog')
      const hasUnsavedChangesText = screen.queryByText(/unsaved changes/i)
      const hasConfirmButton = screen.queryByTestId('confirm-navigation')

      // The fix should show a dialog with unsaved changes warning
      expect(warningDialog).toBeInTheDocument()
      expect(hasUnsavedChangesText).toBeInTheDocument()
      expect(hasConfirmButton).toBeInTheDocument()

      // Navigation should be blocked initially (onOpen not called yet)
      expect(mockOnOpen).not.toHaveBeenCalled()
    }, { timeout: 2000 })

    // **STEP 4: Test confirming navigation**
    const confirmButton = screen.getByTestId('confirm-navigation')
    await user.click(confirmButton)

    // **STEP 5: Verify navigation proceeds after confirmation**
    await waitFor(() => {
      expect(mockOnOpen).toHaveBeenCalled()
      // Dialog should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('should allow dashboard navigation when no prompt has been copied', async () => {
    const user = userEvent.setup()
    const mockOnOpen = vi.fn()

    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={mockOnOpen}
        onStepClick={vi.fn()}
      />
    )

    // **Don't copy the prompt - no changes should be tracked**

    // **Try to navigate back to dashboard**
    const exitButton = screen.getByTestId('exit-button')
    await user.click(exitButton)

    // **Navigation should work normally**
    await waitFor(() => {
      expect(mockOnOpen).toHaveBeenCalled()
    })
  })

  it('should show dialog for back navigation after copying prompt', async () => {
    const user = userEvent.setup()
    const mockOnBack = vi.fn()

    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={mockOnBack}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **Copy the prompt to trigger form changes**
    const copyButton = screen.getByTestId('copy-prompt-button-top')
    await user.click(copyButton)

    // **Try to go back**
    const backButton = screen.getByTestId('back-button')
    await user.click(backButton)

    // **Verify navigation warning dialog appears**
    await waitFor(() => {
      const warningDialog = screen.queryByRole('dialog')
      const hasUnsavedChangesText = screen.queryByText(/unsaved changes/i)

      expect(warningDialog).toBeInTheDocument()
      expect(hasUnsavedChangesText).toBeInTheDocument()
      expect(mockOnBack).not.toHaveBeenCalled()
    })

    // **Test canceling navigation**
    const cancelButton = screen.getByTestId('cancel-navigation')
    await user.click(cancelButton)

    await waitFor(() => {
      // Dialog should close and navigation should not proceed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(mockOnBack).not.toHaveBeenCalled()
    })
  })
})