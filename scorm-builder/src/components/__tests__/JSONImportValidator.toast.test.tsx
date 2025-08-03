import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSONImportValidator } from '../JSONImportValidator'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    readText: vi.fn(),
  },
})

describe('JSONImportValidator Toast Notifications', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnHelp = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnStepClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('should show toast notification when clipboard paste fails', async () => {
    // Make clipboard fail
    vi.mocked(navigator.clipboard.readText).mockRejectedValueOnce(new Error('Failed'))

    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onBack={mockOnBack}
        onSettingsClick={mockOnSettingsClick}
        onHelp={mockOnHelp}
        onSave={mockOnSave}
        onOpen={mockOnOpen}
        onStepClick={mockOnStepClick}
      />
    )

    // Find and click paste button
    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
    fireEvent.click(pasteButton)

    // Should show toast notification instead of alert
    await waitFor(() => {
      expect(screen.getByText(/failed to read from clipboard/i)).toBeInTheDocument()
      expect(window.alert).not.toHaveBeenCalled()
    })
  })

  it('should show success toast when clipboard paste succeeds', async () => {
    const mockJSON = JSON.stringify({ 
      welcomePage: { id: 'welcome', title: 'Welcome', content: 'Test', narration: 'Test' ,
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
      learningObjectivesPage: { id: 'objectives', title: 'Objectives', content: 'Test', narration: 'Test' ,
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
      topics: [],
      assessment: { questions: [], passMark: 80 }
    })
    
    // Make clipboard succeed
    vi.mocked(navigator.clipboard.readText).mockResolvedValueOnce(mockJSON)

    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onBack={mockOnBack}
        onSettingsClick={mockOnSettingsClick}
        onHelp={mockOnHelp}
        onSave={mockOnSave}
        onOpen={mockOnOpen}
        onStepClick={mockOnStepClick}
      />
    )

    // Find and click paste button
    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
    fireEvent.click(pasteButton)

    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/pasted from clipboard/i)).toBeInTheDocument()
    })

    // Should populate the textarea
    const textarea = screen.getByPlaceholderText(/paste your json data here/i)
    expect(textarea).toHaveValue(mockJSON)
  })
})