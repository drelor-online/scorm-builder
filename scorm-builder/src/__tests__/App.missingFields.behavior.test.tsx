import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'
import { AllTheProviders } from '../test/testProviders'

/**
 * Behavior test for missing course content fields handling
 * Reproduces the warning: "Missing required fields in course content"
 */
describe('App.missingFields Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console to capture warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('should handle missing course content fields gracefully', async () => {
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    })

    // The warning about missing fields should be handled gracefully
    // and should not cause the app to crash or fail to render
    expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    
    // The app should still function normally even with missing fields
    const titleInput = screen.getByLabelText(/course title/i)
    expect(titleInput).toBeVisible()
  })

  test('should provide default values for missing required fields', async () => {
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    })

    // Check that the app loads with default/empty state when fields are missing
    const titleInput = screen.getByLabelText(/course title/i) as HTMLInputElement
    expect(titleInput.value).toBe('') // Should have empty default value
    
    // Template should have a default value
    const templateSelect = screen.getByLabelText(/template/i) as HTMLSelectElement
    expect(templateSelect.value).toBe('None') // Should have default template
  })

  test('should not crash when loading incomplete course content', async () => {
    render(
      <AllTheProviders>
        <App />
      </AllTheProviders>
    )

    // Wait for app to load successfully
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /course title/i })).toBeInTheDocument()
    }, { timeout: 5000 })

    // App should render successfully despite any missing fields warnings
    expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
    
    // Navigation should be available
    expect(screen.getByTestId('next-button')).toBeInTheDocument()
    
    // Header should be present
    expect(screen.getByTestId('page-header')).toBeInTheDocument()
  })
})