import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSONImportValidator } from '../../../components/JSONImportValidatorRefactored'

// Mock clipboard API
const mockReadText = vi.fn()
const mockWriteText = vi.fn()

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

// Mock PageLayout to render children and handle Next button
vi.mock('../../../components/PageLayout', () => ({
  PageLayout: ({ children, title, description, onNext, coursePreview }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
      {coursePreview}
      <button onClick={onNext}>Next</button>
    </div>
  )
}))

// Mock DesignSystem components
vi.mock('../../../components/DesignSystem', () => {
  const React = require('react')
  return {
    Button: ({ children, onClick, variant, disabled, icon }: any) => (
      <button onClick={onClick} data-variant={variant} disabled={disabled}>
        {icon && <span>{icon}</span>}
        {children}
      </button>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    Input: React.forwardRef(({ label, value, onChange, placeholder, multiline, rows, fullWidth, style, className, disabled }: any, ref: any) => {
      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (onChange && !disabled) {
          onChange(e)
        }
      }
      
      if (multiline) {
        return (
          <div>
            {label && <label>{label}</label>}
            <textarea
              ref={ref}
              value={value || ''}
              onChange={handleChange}
              placeholder={placeholder}
              rows={rows}
              aria-label={label}
              style={style}
              className={className}
              disabled={disabled}
            />
          </div>
        )
      }
      return (
        <div>
          {label && <label>{label}</label>}
          <input
            ref={ref}
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder}
            aria-label={label}
            style={style}
            className={className}
            disabled={disabled}
          />
        </div>
      )
    }),
    ButtonGroup: ({ children }: any) => <div data-testid="button-group">{children}</div>,
    Section: ({ children }: any) => <section>{children}</section>,
    Flex: ({ children }: any) => <div data-testid="flex">{children}</div>
  }
})

// Test wrapper to handle state management
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

describe('JSON Import & Validation Page Behavior', () => {
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
  
  const validJSON = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<h1>Welcome</h1>',
      narration: 'Welcome narration text'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1',
        content: '<p>Content 1</p>',
        narration: 'Topic 1 narration'
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A'
        }
      ]
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockReadText.mockReset()
    mockWriteText.mockReset()
    mockReadText.mockResolvedValue('')
    
    // Re-apply the mock to window.navigator.clipboard
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        readText: mockReadText,
        writeText: mockWriteText
      },
      writable: true,
      configurable: true
    })
  })

  it('should open empty for first time use', () => {
    render(<JSONImportValidator {...mockHandlers} />)
    
    // Check page title and description
    expect(screen.getByText('JSON Import & Validation')).toBeInTheDocument()
    expect(screen.getByText('Paste the JSON response from your AI chatbot below, or upload a JSON file.')).toBeInTheDocument()
    
    // Check that textarea is empty
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    expect(jsonInput.value).toBe('')
    
    // Validate button should be disabled when empty
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    expect(validateButton).toBeDisabled()
  })

  it.skip('should show paste from clipboard button and toast on success', async () => {
    const user = userEvent.setup()
    const testJSON = JSON.stringify(validJSON, null, 2)
    mockReadText.mockResolvedValueOnce(testJSON)
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    // Verify initial state
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    expect(jsonInput.value).toBe('')
    
    // Click paste button
    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
    await user.click(pasteButton)
    
    // Check success toast appears
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Pasted from clipboard!')
      expect(alert).toHaveAttribute('data-type', 'success')
    })
    
    // Check that clipboard was called
    expect(mockReadText).toHaveBeenCalledTimes(1)
  })

  it.skip('should handle clipboard errors gracefully', async () => {
    const user = userEvent.setup()
    
    // Set up rejection for this specific test
    mockReadText.mockRejectedValueOnce(new Error('Clipboard access denied'))
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    // Click paste button
    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
    await user.click(pasteButton)
    
    // Check error toast
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Failed to read from clipboard. Please paste manually or check browser permissions.')
      expect(alert).toHaveAttribute('data-type', 'error')
    })
  })

  it.skip('should allow manual typing of JSON', async () => {
    const user = userEvent.setup()
    
    const { rerender } = render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    
    // Initially, validate button should be disabled
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    expect(validateButton).toBeDisabled()
    
    // Type some text
    await user.click(jsonInput)
    await user.type(jsonInput, '{"test": true}')
    
    // Force a re-render to ensure state updates are reflected
    rerender(<JSONImportValidator {...mockHandlers} />)
    
    // Check that validate button is now enabled  
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /validate json/i })).not.toBeDisabled()
    }, { timeout: 2000 })
  })

  it('should validate JSON and show exact errors for missing fields', async () => {
    const user = userEvent.setup()
    const invalidJSON = {
      // Missing welcomePage
      learningObjectivesPage: validJSON.learningObjectivesPage,
      topics: validJSON.topics,
      assessment: validJSON.assessment
    }
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    // Use paste instead of type for complex JSON
    await user.click(jsonInput)
    await user.paste(JSON.stringify(invalidJSON))
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check error message
    await waitFor(() => {
      expect(screen.getByText('Validation Error')).toBeInTheDocument()
      expect(screen.getByText('Missing required field: welcomePage')).toBeInTheDocument()
    })
  })

  it('should validate JSON and show error for invalid syntax', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    // Use paste to avoid special character issues
    await user.click(jsonInput)
    await user.paste('{ invalid: json syntax }')
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check error message
    await waitFor(() => {
      expect(screen.getByText('Validation Error')).toBeInTheDocument()
      expect(screen.getByText('Invalid JSON syntax')).toBeInTheDocument()
    })
  })

  it('should detect and reject old JSON format', async () => {
    const user = userEvent.setup()
    const oldFormatJSON = {
      activities: [], // Old format indicator
      quiz: [], // Old format indicator
      topics: []
    }
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(oldFormatJSON))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check error message
    await waitFor(() => {
      expect(screen.getByText('Validation Error')).toBeInTheDocument()
      expect(screen.getByText(/Invalid format: This appears to be the old JSON format/)).toBeInTheDocument()
    })
  })

  it('should show success and summary when JSON is valid', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(validJSON, null, 2))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check success message
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
      // 3 pages (welcome + objectives + 1 topic), 0 knowledge check questions, 1 assessment question
      expect(screen.getByText(/3 pages.*0 knowledge check questions.*1 assessment questions/)).toBeInTheDocument()
    })
  })

  it('should show course preview after successful validation', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(validJSON, null, 2))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check that preview appears
    await waitFor(() => {
      expect(screen.getByTestId('course-preview')).toBeInTheDocument()
    })
  })

  it('should enable Next button only after successful validation', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(validJSON, null, 2))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
    })
    
    // Now trigger Next action
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    // Check that onNext was called with the parsed data
    expect(mockHandlers.onNext).toHaveBeenCalledWith(validJSON)
  })

  it.skip('should handle empty input validation', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    // Type some spaces to enable validate button
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.type(jsonInput, '   ') // Just spaces
    
    // Wait for button to be enabled
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check error message
    await waitFor(() => {
      expect(screen.getByText('Validation Error')).toBeInTheDocument()
      expect(screen.getByText('Please enter JSON data')).toBeInTheDocument()
    })
  })

  it('should load initial data if provided', () => {
    const initialData = validJSON
    
    render(<JSONImportValidator {...mockHandlers} initialData={initialData} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    expect(jsonInput.value).toBe(JSON.stringify(initialData, null, 2))
  })

  // Tests for new features
  it('should lock JSON input after successful validation', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(validJSON, null, 2))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
    })
    
    // Check that input is disabled
    expect(jsonInput).toBeDisabled()
    
    // Check that validate button is disabled
    expect(validateButton).toBeDisabled()
  })
  
  it('should show Clear button after successful validation', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    // Clear button should not exist initially
    expect(screen.queryByRole('button', { name: /clear json/i })).not.toBeInTheDocument()
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(validJSON, null, 2))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
    })
    
    // Check that Clear button appears
    expect(screen.getByRole('button', { name: /clear json/i })).toBeInTheDocument()
  })
  
  it('should warn about data loss when Clear button is pressed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(JSON.stringify(validJSON, null, 2))
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
    })
    
    // Click clear button
    const clearButton = screen.getByRole('button', { name: /clear json/i })
    await user.click(clearButton)
    
    // Check that confirmation was requested
    expect(confirmSpy).toHaveBeenCalledWith('Warning: Clearing the JSON will delete all data on the following pages. Are you sure you want to continue?')
    
    // Check that input was cleared
    expect(jsonInput.value).toBe('')
    
    // Check that input is no longer disabled
    expect(jsonInput).not.toBeDisabled()
    
    confirmSpy.mockRestore()
  })
  
  it('should auto-fix easy validation errors and report to user', async () => {
    const user = userEvent.setup()
    
    render(<JSONImportValidator {...mockHandlers} />)
    
    // JSON with trailing comma (common error)
    const jsonWithError = `{
      "welcomePage": ${JSON.stringify(validJSON.welcomePage)},
      "learningObjectivesPage": ${JSON.stringify(validJSON.learningObjectivesPage)},
      "topics": ${JSON.stringify(validJSON.topics)},
      "assessment": ${JSON.stringify(validJSON.assessment)},
    }` // Note the trailing comma after assessment
    
    const jsonInput = screen.getByLabelText('JSON Input') as HTMLTextAreaElement
    await user.click(jsonInput)
    await user.paste(jsonWithError)
    
    // Wait for the state to update
    await waitFor(() => {
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      expect(validateButton).not.toBeDisabled()
    })
    
    // Click validate
    const validateButton = screen.getByRole('button', { name: /validate json/i })
    await user.click(validateButton)
    
    // Check for success and auto-fix notification
    await waitFor(() => {
      expect(screen.getByText('Valid JSON Structure')).toBeInTheDocument()
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(/Auto-fixed.*trailing comma/i)
      expect(alert).toHaveAttribute('data-type', 'info')
    })
    
    // Check that JSON was corrected
    expect(jsonInput.value).not.toContain(',\n    }')
  })
})