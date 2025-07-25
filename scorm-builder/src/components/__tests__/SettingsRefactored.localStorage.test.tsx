import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Settings } from '../SettingsRefactored'

describe('SettingsRefactored - localStorage persistence', () => {
  const mockOnSave = vi.fn()
  const localStorageKey = 'scorm_builder_api_keys'
  
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should load API keys from localStorage on mount', () => {
    // Set up localStorage with saved API keys
    const savedApiKeys = {
      googleImageApiKey: 'saved-google-key',
      googleCseId: 'saved-cse-id',
      youtubeApiKey: 'saved-youtube-key'
    }
    localStorage.setItem(localStorageKey, JSON.stringify(savedApiKeys))

    render(<Settings onSave={mockOnSave} />)

    // Check that inputs are populated with saved values
    const googleApiInput = screen.getByLabelText(/google image search api key/i) as HTMLInputElement
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i) as HTMLInputElement
    const youtubeInput = screen.getByLabelText(/youtube data api key/i) as HTMLInputElement

    expect(googleApiInput.value).toBe('saved-google-key')
    expect(cseInput.value).toBe('saved-cse-id')
    expect(youtubeInput.value).toBe('saved-youtube-key')
  })

  it('should save API keys to localStorage when form is submitted', async () => {
    render(<Settings onSave={mockOnSave} />)

    // Fill in the form
    const googleApiInput = screen.getByLabelText(/google image search api key/i)
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i)
    const youtubeInput = screen.getByLabelText(/youtube data api key/i)
    
    fireEvent.change(googleApiInput, { target: { value: 'new-google-key' } })
    fireEvent.change(cseInput, { target: { value: 'new-cse-id' } })
    fireEvent.change(youtubeInput, { target: { value: 'new-youtube-key' } })
    
    // Submit form
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      const saved = localStorage.getItem(localStorageKey)
      expect(saved).toBeTruthy()
      
      const savedData = JSON.parse(saved!)
      expect(savedData).toEqual({
        googleImageApiKey: 'new-google-key',
        googleCseId: 'new-cse-id',
        youtubeApiKey: 'new-youtube-key'
      })
    })
  })

  it('should handle corrupted localStorage data gracefully', () => {
    // Set corrupted data in localStorage
    localStorage.setItem(localStorageKey, 'invalid-json-data')

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<Settings onSave={mockOnSave} />)

    // Should render with empty form values despite corrupted data
    const googleApiInput = screen.getByLabelText(/google image search api key/i) as HTMLInputElement
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i) as HTMLInputElement
    const youtubeInput = screen.getByLabelText(/youtube data api key/i) as HTMLInputElement

    expect(googleApiInput.value).toBe('')
    expect(cseInput.value).toBe('')
    expect(youtubeInput.value).toBe('')

    consoleErrorSpy.mockRestore()
  })

  it('should persist API keys between component remounts', async () => {
    const { unmount } = render(<Settings onSave={mockOnSave} />)

    // Fill and save form
    const googleApiInput = screen.getByLabelText(/google image search api key/i)
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i)
    const youtubeInput = screen.getByLabelText(/youtube data api key/i)
    
    fireEvent.change(googleApiInput, { target: { value: 'persistent-google-key' } })
    fireEvent.change(cseInput, { target: { value: 'persistent-cse-id' } })
    fireEvent.change(youtubeInput, { target: { value: 'persistent-youtube-key' } })
    
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    })

    // Unmount and remount component
    unmount()
    render(<Settings onSave={mockOnSave} />)

    // Check that values persist
    const newGoogleApiInput = screen.getByLabelText(/google image search api key/i) as HTMLInputElement
    const newCseInput = screen.getByLabelText(/google custom search engine.*id/i) as HTMLInputElement
    const newYoutubeInput = screen.getByLabelText(/youtube data api key/i) as HTMLInputElement

    expect(newGoogleApiInput.value).toBe('persistent-google-key')
    expect(newCseInput.value).toBe('persistent-cse-id')
    expect(newYoutubeInput.value).toBe('persistent-youtube-key')
  })

  it('should show saved API keys as masked by default', () => {
    const savedApiKeys = {
      googleImageApiKey: 'saved-google-key',
      googleCseId: 'saved-cse-id',
      youtubeApiKey: 'saved-youtube-key'
    }
    localStorage.setItem(localStorageKey, JSON.stringify(savedApiKeys))

    render(<Settings onSave={mockOnSave} />)

    const googleApiInput = screen.getByLabelText(/google image search api key/i) as HTMLInputElement
    const youtubeInput = screen.getByLabelText(/youtube data api key/i) as HTMLInputElement

    // Should be password type to mask the saved keys
    expect(googleApiInput.type).toBe('password')
    expect(youtubeInput.type).toBe('password')
  })
})