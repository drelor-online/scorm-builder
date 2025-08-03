import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Settings } from '../Settings'

describe('Settings with Design System', () => {
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('uses design system components for layout', () => {
    render(<Settings onSave={mockOnSave} />)

    // Check for Card components
    const cards = document.querySelectorAll('.card')
    expect(cards.length).toBeGreaterThan(0)
    
    // Check for Section components
    const sections = document.querySelectorAll('.section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('uses Button components with consistent styling', () => {
    render(<Settings onSave={mockOnSave} />)

    // Check toggle visibility button
    const toggleButton = screen.getByRole('button', { name: /toggle api key visibility/i })
    expect(toggleButton).toHaveClass('btn')
    
    // Check save button
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    expect(saveButton).toHaveClass('btn', 'btn-primary')
  })

  it('uses Input components for form fields', () => {
    render(<Settings onSave={mockOnSave} />)

    // Should use Input components with proper labels
    const googleApiInput = screen.getByLabelText(/google image search api key/i)
    expect(googleApiInput.parentElement).toHaveClass('input-wrapper')
    
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i)
    expect(cseInput.parentElement).toHaveClass('input-wrapper')
    
    const youtubeInput = screen.getByLabelText(/youtube data api key/i)
    expect(youtubeInput.parentElement).toHaveClass('input-wrapper')
  })

  it('validates form and prevents submission with empty fields', async () => {
    render(<Settings onSave={mockOnSave} />)

    // Submit empty form
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    // Should not call onSave when validation fails
    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  it('uses Alert component for help information', () => {
    render(<Settings onSave={mockOnSave} />)

    // Should show help info in alert
    const helpSection = screen.getByText(/getting your api keys/i)
    const alertElement = helpSection.closest('.alert')
    expect(alertElement).toBeInTheDocument()
    expect(alertElement).toHaveClass('alert-info')
  })

  it('uses Grid layout for form fields', () => {
    render(<Settings onSave={mockOnSave} />)

    const grids = container.querySelectorAll('.grid')
    expect(grids.length).toBeGreaterThan(0)
  })

  it('toggles password visibility for API key fields', () => {
    render(<Settings onSave={mockOnSave} />)

    const googleApiInput = screen.getByLabelText(/google image search api key/i) as HTMLInputElement
    const youtubeInput = screen.getByLabelText(/youtube data api key/i) as HTMLInputElement
    
    // Initially should be password type
    expect(googleApiInput.type).toBe('password')
    expect(youtubeInput.type).toBe('password')
    
    // Toggle visibility
    const toggleButton = screen.getByRole('button', { name: /toggle api key visibility/i })
    fireEvent.click(toggleButton)
    
    // Should now be text type
    expect(googleApiInput.type).toBe('text')
    expect(youtubeInput.type).toBe('text')
  })

  it('validates form before saving', async () => {
    render(<Settings onSave={mockOnSave} />)

    // Try to save with empty form
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  it('calls onSave with form data when valid', async () => {
    render(<Settings onSave={mockOnSave} />)

    // Fill in the form
    const googleApiInput = screen.getByLabelText(/google image search api key/i)
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i)
    const youtubeInput = screen.getByLabelText(/youtube data api key/i)
    
    fireEvent.change(googleApiInput, { target: { value: 'test-google-api-key' } })
    fireEvent.change(cseInput, { target: { value: 'test-cse-id' } })
    fireEvent.change(youtubeInput, { target: { value: 'test-youtube-key' } })
    
    // Submit form
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        googleImageApiKey: 'test-google-api-key',
        googleCseId: 'test-cse-id',
        youtubeApiKey: 'test-youtube-key'
      })
    })
  })

  it('allows form submission when all fields are filled', async () => {
    render(<Settings onSave={mockOnSave} />)

    // Fill in all fields
    const googleApiInput = screen.getByLabelText(/google image search api key/i)
    const cseInput = screen.getByLabelText(/google custom search engine.*id/i)
    const youtubeInput = screen.getByLabelText(/youtube data api key/i)
    
    fireEvent.change(googleApiInput, { target: { value: 'google-key' } })
    fireEvent.change(cseInput, { target: { value: 'cse-id' } })
    fireEvent.change(youtubeInput, { target: { value: 'youtube-key' } })

    // Submit form
    const saveButton = screen.getByRole('button', { name: /save settings/i })
    fireEvent.click(saveButton)

    // Should call onSave with the data
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        googleImageApiKey: 'google-key',
        googleCseId: 'cse-id',
        youtubeApiKey: 'youtube-key'
      })
    })
  })

  it('uses consistent spacing with Section components', () => {
    render(<Settings onSave={mockOnSave} />)

    const sections = container.querySelectorAll('.section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('displays API configuration in a Card component', () => {
    render(<Settings onSave={mockOnSave} />)

    // Should have API Configuration section in a card
    const apiConfigTitle = screen.getByText('API Configuration')
    const card = apiConfigTitle.closest('.card')
    expect(card).toBeInTheDocument()
  })
})