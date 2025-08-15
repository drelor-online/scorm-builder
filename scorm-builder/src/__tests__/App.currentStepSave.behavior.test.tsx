import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { AllTheProviders } from '../test/testProviders'

/**
 * Behavior test for currentStep saving issue
 * Reproduces the error: "invalid args 'projectData' for command 'save_project': invalid type: integer '1', expected a string"
 */
describe('App.currentStepSave Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console to capture errors
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('should save currentStep as string, not integer when submitting course seed', async () => {
    const user = userEvent.setup()
    
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load - look for course title input field
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    })

    // Fill out the course seed form
    const titleInput = screen.getByLabelText(/course title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Test Course')

    // First select a template to enable topics
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'Safety')
    
    // Wait a bit for state to update and next button to be enabled
    await waitFor(() => {
      const nextButton = screen.getByTestId('next-button')
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })

    // Submit the form
    const nextButton = screen.getByTestId('next-button')
    await user.click(nextButton)

    // This should trigger the error we're testing for
    // The error occurs when saving currentStep with integer value instead of string
    await waitFor(() => {
      // Check that console.error was called with the specific error message
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save course seed data:'),
        expect.stringContaining('invalid type: integer')
      )
    }, { timeout: 8000 })
  })

  test('should handle currentStep save operation without type errors', async () => {
    const user = userEvent.setup()
    
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load - look for course title input field
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    })

    // Fill out the course seed form
    const titleInput = screen.getByLabelText(/course title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Test Course Save')

    // Select safety template to get topics
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'Safety')

    // Submit the form
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    // Wait for navigation to succeed (this test should pass after we fix the issue)
    await waitFor(() => {
      // The error should NOT occur - no type mismatch errors in console
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('invalid type: integer'),
        expect.anything()
      )
    }, { timeout: 5000 })
  })
})