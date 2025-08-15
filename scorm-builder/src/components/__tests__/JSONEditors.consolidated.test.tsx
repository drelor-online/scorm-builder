/**
 * JSONEditors - Consolidated Test Suite
 * 
 * This file consolidates JSON Editor tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - MonacoJSONEditor.test.tsx (basic Monaco JSON editor functionality)
 * - MonacoJSONEditor.colonbreak.test.tsx (colon line break issue fixes)
 * - SimpleJSONEditor.autoFixDialog.test.tsx (auto-fix dialog behavior)
 * 
 * Test Categories:
 * - MonacoJSONEditor basic functionality
 * - Colon preservation in string values
 * - Auto-formatting behavior and controls
 * - SimpleJSONEditor auto-fix dialog
 * - JSON validation and error handling
 * - User interaction flows
 * - Performance and edge cases
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MonacoJSONEditor } from '../MonacoJSONEditor'
import { SimpleJSONEditor } from '../SimpleJSONEditor'

// Mock editor instances for testing
let mockEditorInstance: any = null
let mockMonacoInstance: any = null

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options, onMount }: any) => {
    // Create comprehensive mock editor instance
    mockEditorInstance = {
      getValue: vi.fn(() => value),
      setValue: vi.fn((val: string) => {
        // Simulate the colon line break issue when formatting is enabled
        if (options?.formatOnType !== false || options?.formatOnPaste !== false) {
          // Bug simulation: break after colons
          const broken = val.replace(/: /g, ':\n')
          onChange?.(broken)
        } else {
          // When formatting is disabled, preserve the original
          onChange?.(val)
        }
      }),
      getModel: vi.fn(() => ({ uri: 'test://model' })),
      getAction: vi.fn(() => ({ run: vi.fn() })),
      onDidChangeModelDecorations: vi.fn(),
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
      revealLineInCenter: vi.fn(),
      setPosition: vi.fn(),
      getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
      focus: vi.fn(),
      addCommand: vi.fn(),
      updateOptions: vi.fn()
    }
    
    mockMonacoInstance = {
      languages: {
        json: {
          jsonDefaults: {
            setDiagnosticsOptions: vi.fn()
          }
        },
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn(),
        setLanguageConfiguration: vi.fn(),
        registerDocumentFormattingEditProvider: vi.fn(),
        registerDocumentRangeFormattingEditProvider: vi.fn(),
        registerOnTypeFormattingEditProvider: vi.fn()
      },
      editor: {
        getModelMarkers: vi.fn(() => [])
      },
      KeyMod: { Shift: 1024 },
      KeyCode: { KeyF: 41 }
    }
    
    React.useEffect(() => {
      if (onMount) {
        onMount(mockEditorInstance, mockMonacoInstance)
      }
    }, [onMount])
    
    // Simulate paste event behavior
    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pastedText = e.clipboardData.getData('text')
      
      if (options?.formatOnType !== false || options?.formatOnPaste !== false) {
        // Simulate the bug: breaks after colons
        const broken = pastedText.replace(/: /g, ':\n')
        onChange?.(broken)
      } else {
        // Should preserve original
        onChange?.(pastedText)
      }
    }
    
    return (
      <div data-testid="monaco-editor">
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onPaste={handlePaste}
          data-testid="monaco-textarea"
          style={{ width: '100%', height: '400px' }}
        />
        <div>formatOnPaste: {options?.formatOnPaste ? 'true' : 'false'}</div>
        <div>formatOnType: {options?.formatOnType ? 'true' : 'false'}</div>
      </div>
    )
  }
}))

describe('JSONEditors - Consolidated Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEditorInstance = null
    mockMonacoInstance = null
  })

  describe('MonacoJSONEditor - Basic Functionality', () => {
    it('should disable auto-formatting to prevent colon line breaks', () => {
      const { container } = render(
        <MonacoJSONEditor
          value='{"test": "Part 192 requires: documentation"}'
          onChange={() => {}}
          height="400px"
        />
      )
      
      // Check that auto-formatting is disabled
      expect(container.textContent).toContain('formatOnPaste: false')
      expect(container.textContent).toContain('formatOnType: false')
    })

    it('should render Monaco editor with correct props', () => {
      render(
        <MonacoJSONEditor
          value='{"test": "value"}'
          onChange={vi.fn()}
          height="400px"
        />
      )
      
      const editor = screen.getByTestId('monaco-editor')
      expect(editor).toBeInTheDocument()
      
      const textarea = screen.getByTestId('monaco-textarea')
      expect(textarea).toHaveValue('{"test": "value"}')
    })

    it('should call onChange when editor content changes', () => {
      const onChange = vi.fn()
      
      render(
        <MonacoJSONEditor
          value='{"test": "old"}'
          onChange={onChange}
          height="400px"
        />
      )
      
      const textarea = screen.getByTestId('monaco-textarea')
      fireEvent.change(textarea, { target: { value: '{"test": "new"}' } })
      
      expect(onChange).toHaveBeenCalledWith('{"test": "new"}')
    })

    it('should initialize Monaco with proper configuration', () => {
      render(
        <MonacoJSONEditor
          value=""
          onChange={vi.fn()}
          height="400px"
        />
      )
      
      // Verify Monaco instance was configured
      expect(mockMonacoInstance?.languages.json.jsonDefaults.setDiagnosticsOptions).toHaveBeenCalled()
    })
  })

  describe('MonacoJSONEditor - Colon Preservation', () => {
    it('should preserve colons in string values without breaking lines', () => {
      const jsonWithColons = `{
  "narration": "Part 192 Subpart L requires: proper documentation",
  "content": "The rule states: always follow procedures"
}`
      
      let currentValue = jsonWithColons
      const handleChange = (val: string) => {
        currentValue = val
      }
      
      render(
        <MonacoJSONEditor
          value={jsonWithColons}
          onChange={handleChange}
          height="400px"
        />
      )
      
      // Value should not be modified due to disabled formatting
      expect(currentValue).toBe(jsonWithColons)
      expect(currentValue).toContain('Part 192 Subpart L requires:')
      expect(currentValue).toContain('The rule states:')
    })

    it('should not break lines after colons when pasting JSON', async () => {
      const jsonWithColons = `{
  "narration": "Part 192 Subpart L requires: proper documentation of all activities"
}`
      
      let currentValue = ''
      const handleChange = (val: string) => {
        currentValue = val
      }
      
      const { getByTestId } = render(
        <MonacoJSONEditor
          value=""
          onChange={handleChange}
          height="400px"
        />
      )
      
      const textarea = getByTestId('monaco-textarea') as HTMLTextAreaElement
      
      // Simulate pasting JSON with colons
      const clipboardData = {
        getData: (type: string) => type === 'text' ? jsonWithColons : ''
      }
      
      fireEvent.paste(textarea, { clipboardData })
      
      await waitFor(() => {
        // Value should NOT have line breaks after colons
        expect(currentValue).not.toContain('requires:\n')
        expect(currentValue).toContain('requires: proper')
        
        // Verify JSON is still valid
        const parsed = JSON.parse(currentValue)
        expect(parsed.narration).toBe('Part 192 Subpart L requires: proper documentation of all activities')
      })
    })

    it('should handle multiple colons in complex JSON without breaking lines', async () => {
      const complexJSON = `{
  "welcomePage": {
    "narration": "Part 192 Subpart L requires: proper documentation. The rule states: always follow procedures."
  },
  "topics": [
    {
      "content": "Time: 10:30 AM. Location: Station A. Note: Important.",
      "narration": "Meeting scheduled for: 3:00 PM. The agenda includes: reviewing all procedures."
    }
  ]
}`
      
      let currentValue = ''
      const handleChange = (val: string) => {
        currentValue = val
      }
      
      const { getByTestId } = render(
        <MonacoJSONEditor
          value=""
          onChange={handleChange}
          height="400px"
        />
      )
      
      const textarea = getByTestId('monaco-textarea') as HTMLTextAreaElement
      const clipboardData = {
        getData: (type: string) => type === 'text' ? complexJSON : ''
      }
      
      fireEvent.paste(textarea, { clipboardData })
      
      await waitFor(() => {
        // Verify no lines were broken after any colons
        expect(currentValue).not.toContain('requires:\n')
        expect(currentValue).not.toContain('states:\n')
        expect(currentValue).not.toContain('Time:\n')
        expect(currentValue).not.toContain('Location:\n')
        expect(currentValue).not.toContain('Note:\n')
        expect(currentValue).not.toContain('for:\n')
        expect(currentValue).not.toContain('includes:\n')
        
        // Verify structure is preserved
        expect(currentValue).toContain('requires: proper')
        expect(currentValue).toContain('states: always')
        expect(currentValue).toContain('Time: 10:30')
        
        // Verify JSON validity
        const parsed = JSON.parse(currentValue)
        expect(parsed.welcomePage.narration).toContain('requires: proper')
        expect(parsed.topics[0].content).toContain('Time: 10:30')
      })
    })

    it('should handle typing colons without breaking lines', async () => {
      let currentValue = ''
      const handleChange = (val: string) => {
        currentValue = val
      }
      
      const { getByTestId } = render(
        <MonacoJSONEditor
          value='{"test": ""}'
          onChange={handleChange}
          height="400px"
        />
      )
      
      const textarea = getByTestId('monaco-textarea') as HTMLTextAreaElement
      const newValue = '{"test": "The rule states: follow procedures"}'
      
      fireEvent.change(textarea, { target: { value: newValue } })
      
      await waitFor(() => {
        // Value should not have line break after colon
        expect(currentValue).not.toContain('states:\n')
        expect(currentValue).toContain('states: follow')
        expect(currentValue).toBe(newValue)
      })
    })
  })

  describe('SimpleJSONEditor - Auto-Fix Dialog', () => {
    const mockOnChange = vi.fn()
    const mockOnValidate = vi.fn()

    beforeEach(() => {
      mockOnChange.mockClear()
      mockOnValidate.mockClear()
    })

    it('should show auto-fix dialog when JSON has syntax errors', async () => {
      render(
        <SimpleJSONEditor
          value=""
          onChange={mockOnChange}
          onValidate={mockOnValidate}
        />
      )

      const textarea = screen.getByTestId('json-textarea') as HTMLTextAreaElement
      const invalidJson = '{"title": "Test Course'  // Missing closing quote and brace
      
      fireEvent.change(textarea, { target: { value: invalidJson } })

      // Wait for validation and dialog
      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalledWith(false, expect.any(Array))
      })

      await waitFor(() => {
        expect(screen.getByText(/There were issues found in the JSON content/i)).toBeInTheDocument()
        expect(screen.getByText(/Would you like to attempt to fix these issues automatically/i)).toBeInTheDocument()
      })

      // Verify dialog buttons
      expect(screen.getByRole('button', { name: /fix automatically/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should apply auto-fix when user confirms dialog', async () => {
      render(
        <SimpleJSONEditor
          value=""
          onChange={mockOnChange}
          onValidate={mockOnValidate}
        />
      )

      const textarea = screen.getByTestId('json-textarea') as HTMLTextAreaElement
      const invalidJson = '{"title": "Test", "count": 5,}'  // Has trailing comma
      
      fireEvent.change(textarea, { target: { value: invalidJson } })

      await waitFor(() => {
        expect(screen.getByText(/There were issues found in the JSON content/i)).toBeInTheDocument()
      })

      // Click Fix Automatically button
      const fixButton = screen.getByRole('button', { name: /fix automatically/i })
      fireEvent.click(fixButton)

      // Check that the JSON was fixed
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('{"title": "Test", "count": 5}')
      })

      // Dialog should close after fixing
      await waitFor(() => {
        expect(screen.queryByText(/There were issues found in the JSON content/i)).not.toBeInTheDocument()
      })
    })

    it('should not modify JSON when user cancels auto-fix', async () => {
      render(
        <SimpleJSONEditor
          value=""
          onChange={mockOnChange}
          onValidate={mockOnValidate}
        />
      )

      const textarea = screen.getByTestId('json-textarea') as HTMLTextAreaElement
      const invalidJson = '{"title": "Test", "count": 5,}'
      
      fireEvent.change(textarea, { target: { value: invalidJson } })

      await waitFor(() => {
        expect(screen.getByText(/There were issues found in the JSON content/i)).toBeInTheDocument()
      })

      // Click Cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText(/There were issues found in the JSON content/i)).not.toBeInTheDocument()
      })

      // JSON should not be changed
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should not show dialog for valid JSON', async () => {
      render(
        <SimpleJSONEditor
          value=""
          onChange={mockOnChange}
          onValidate={mockOnValidate}
        />
      )

      const textarea = screen.getByTestId('json-textarea') as HTMLTextAreaElement
      const validJson = '{"title": "Test", "count": 5}'
      
      fireEvent.change(textarea, { target: { value: validJson } })

      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalledWith(true, [])
      })

      // Dialog should not appear
      expect(screen.queryByText(/There were issues found in the JSON content/i)).not.toBeInTheDocument()
    })

    it('should not show dialog for empty input', async () => {
      render(
        <SimpleJSONEditor
          value=""
          onChange={mockOnChange}
          onValidate={mockOnValidate}
        />
      )

      const textarea = screen.getByTestId('json-textarea') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: '' } })

      // Wait to ensure no dialog appears
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(screen.queryByText(/There were issues found in the JSON content/i)).not.toBeInTheDocument()
    })
  })

  describe('JSONEditors - Edge Cases and Error Handling', () => {
    it('should handle very large JSON values', () => {
      const largeObject = {}
      for (let i = 0; i < 1000; i++) {
        ;(largeObject as any)[`key${i}`] = `value${i}`
      }
      const largeJSON = JSON.stringify(largeObject, null, 2)
      
      expect(() => {
        render(
          <MonacoJSONEditor
            value={largeJSON}
            onChange={vi.fn()}
            height="400px"
          />
        )
      }).not.toThrow()
    })

    it('should handle special characters in JSON strings', () => {
      const specialCharJSON = '{"text": "Line 1\\nLine 2\\tTabbed: value", "unicode": "\\u0041\\u0042"}'
      
      render(
        <MonacoJSONEditor
          value={specialCharJSON}
          onChange={vi.fn()}
          height="400px"
        />
      )
      
      const textarea = screen.getByTestId('monaco-textarea')
      expect(textarea).toHaveValue(specialCharJSON)
    })

    it('should handle rapid sequential changes', async () => {
      const onChange = vi.fn()
      
      render(
        <SimpleJSONEditor
          value=""
          onChange={onChange}
        />
      )
      
      const textarea = screen.getByTestId('json-textarea')
      
      // Make rapid changes
      fireEvent.change(textarea, { target: { value: '{"a": 1}' } })
      fireEvent.change(textarea, { target: { value: '{"a": 1, "b": 2}' } })
      fireEvent.change(textarea, { target: { value: '{"a": 1, "b": 2, "c": 3}' } })
      
      // Should handle all changes without errors
      expect(onChange).toHaveBeenCalledTimes(3)
    })

    it('should preserve formatting options across re-renders', () => {
      const { rerender } = render(
        <MonacoJSONEditor
          value='{"test": "value"}'
          onChange={vi.fn()}
          height="400px"
        />
      )
      
      rerender(
        <MonacoJSONEditor
          value='{"test": "new value"}'
          onChange={vi.fn()}
          height="400px"
        />
      )
      
      // Formatting should still be disabled
      expect(mockEditorInstance?.updateOptions).toHaveBeenCalled()
    })

    it('should not show auto-fix dialog multiple times for same errors', async () => {
      render(
        <SimpleJSONEditor
          value=""
          onChange={vi.fn()}
          onValidate={vi.fn()}
        />
      )

      const textarea = screen.getByTestId('json-textarea')
      const invalidJson = '{"test": "value"'  // Missing closing brace
      
      fireEvent.change(textarea, { target: { value: invalidJson } })

      await waitFor(() => {
        expect(screen.getByText(/There were issues found in the JSON content/i)).toBeInTheDocument()
      })

      // Cancel the dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText(/There were issues found in the JSON content/i)).not.toBeInTheDocument()
      })

      // Type more invalid content - dialog should not reappear
      fireEvent.change(textarea, { target: { value: invalidJson + ', "another": "field"' } })

      await new Promise(resolve => setTimeout(resolve, 100))
      expect(screen.queryByText(/There were issues found in the JSON content/i)).not.toBeInTheDocument()
    })
  })
})