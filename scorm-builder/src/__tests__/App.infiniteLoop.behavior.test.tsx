import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { AllTheProviders } from '../test/testProviders'

/**
 * Integration test for infinite loop prevention
 * Reproduces the error: "[ERROR] loadProject called too many times! This indicates an infinite loop."
 */
describe('App.infiniteLoop Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console to capture errors
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  test('should not trigger infinite loop when loading project', async () => {
    const user = userEvent.setup()
    
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    })

    // Create a new project by filling out the form
    const titleInput = screen.getByLabelText(/course title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Test Project for Loop Detection')

    // Select safety template
    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'Safety')
    
    // Wait for next button to be enabled
    await waitFor(() => {
      const nextButton = screen.getByTestId('next-button')
      expect(nextButton).not.toBeDisabled()
    }, { timeout: 3000 })

    // Submit the form to trigger project creation and navigation
    const nextButton = screen.getByTestId('next-button')
    await user.click(nextButton)

    // Wait for project to be created and navigation to complete
    await waitFor(() => {
      // Should navigate to prompt step without infinite loop
      expect(screen.getByText('Prompt')).toBeInTheDocument()
    }, { timeout: 8000 })

    // Check that no infinite loop error occurred
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('loadProject called too many times')
    )
  })

  test('should handle project switching without infinite loop', async () => {
    const user = userEvent.setup()
    
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    })

    // Create first project
    const titleInput = screen.getByLabelText(/course title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'First Project')

    const templateSelect = screen.getByLabelText(/template/i)
    await user.selectOptions(templateSelect, 'Safety')
    
    await waitFor(() => {
      const nextButton = screen.getByTestId('next-button')
      expect(nextButton).not.toBeDisabled()
    })

    const nextButton = screen.getByTestId('next-button')
    await user.click(nextButton)

    // Wait for navigation
    await waitFor(() => {
      expect(screen.getByText('Prompt')).toBeInTheDocument()
    }, { timeout: 8000 })

    // Go back to dashboard
    const exitButton = screen.getByTestId('exit-button')
    await user.click(exitButton)

    // Wait for dashboard
    await waitFor(() => {
      expect(screen.getByText('Create New Project')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Check that no infinite loop errors occurred during project switching
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('loadProject called too many times')
    )
  })
})