import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn()
}

const mockProps = {
  onNext: vi.fn(),
  onBack: vi.fn()
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

// Simplified version of the user's actual JSON with escaped brackets AND other invalid escapes
const userBetaJSON = `{
"welcomePage": {
"id": "welcome",
"title": "Welcome to 49 CFR 192",
"content": "<h2>Welcome</h2><p>Welcome to the 49 CFR Part 192 training course for O\\&M personnel.</p>",
"narration": "Welcome to 49 CFR Part 192.",
"imageKeywords": \\["pipeline safety intro", "gas pipeline overview"],
"imagePrompts": \\["Clean infographic style image"],
"videoSearchTerms": \\["49 CFR 192 introduction"],
"duration": 2
},
"learningObjectivesPage": {
"id": "learning-objectives",
"title": "Learning Objectives", 
"content": "<h2>Learning Objectives</h2><p>After completing this course, you will be able to:</p>",
"narration": "By the end of this course you will know how Part 192 is organized.",
"imageKeywords": \\["learning objectives checklist"],
"imagePrompts": \\["Minimalist checklist graphic"],
"videoSearchTerms": \\["learning goals pipeline safety"],
"duration": 3
},
"topics": \\[
{
"id": "topic-0",
"title": "Part 192 Scope, Purpose, and Enforcement",
"content": "<h2>Scope and Applicability</h2><p>Part 192 establishes minimum federal safety standards.</p>",
"narration": "Part 192 sets minimum safety standards for gas pipelines.",
"imageKeywords": \\["PHMSA enforcement", "pipeline scope map"],
"imagePrompts": \\["Map of a gas pipeline network"],
"videoSearchTerms": \\["PHMSA pipeline safety scope"],
"duration": 5,
"knowledgeCheck": {
"questions": \\[
{
"id": "kc-0-1",
"type": "true-false",
"question": "Part 192 sets minimum safety standards for natural gas pipelines.",
"options": \\["True", "False"],
"correctAnswer": "True",
"feedback": {
"correct": "Correct. Part 192 establishes minimum safety standards.",
"incorrect": "Not quite. Part 192 does establish minimum safety standards."
}
}
]
}
}
],
"assessment": {
"questions": \\[
{
"id": "a-1",
"type": "multiple-choice",
"question": "Part 192 primarily governs which commodity?",
"options": \\["Natural gas", "Crude oil", "Ammonia", "Hydrogen peroxide"],
"correctAnswer": "Natural gas",
"feedback": {
"correct": "Correct. Part 192 covers natural gas pipelines.",
"incorrect": "Incorrect. Part 192 covers natural gas, not the listed alternatives."
}
}
],
"passMark": 80,
"narration": ""
}
}`

describe('JSONImportValidator - User Beta Tester JSON Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should successfully auto-fix and validate user beta tester JSON', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Mock console.log to track the auto-fix process
    let detectedEscapedBrackets = false
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      if (args[0]?.includes && args[0].includes('Detected escaped brackets')) {
        detectedEscapedBrackets = true
      }
    })
    
    // Input the user's problematic JSON
    fireEvent.change(textarea, { 
      target: { value: userBetaJSON } 
    })

    // Should successfully auto-fix and validate
    await waitFor(() => {
      const success = screen.queryByText(/ready to import/i) || 
                     screen.queryByText(/automatically fixed/i) ||
                     screen.queryByText(/valid JSON/i) ||
                     screen.queryByText(/successfully/i)
      expect(success).toBeTruthy()
    }, { timeout: 8000 })
    
    // Should have detected the escaped brackets
    expect(detectedEscapedBrackets).toBe(true)
    
    // Verify that the saved content doesn't have invalid escape sequences
    expect(mockStorage.saveContent).toHaveBeenCalled()
    const savedData = mockStorage.saveContent.mock.calls[0][1]
    
    // Should not contain invalid escape sequences
    expect(savedData).not.toContain('\\&')
    expect(savedData).not.toContain('\\[')
    expect(savedData).not.toContain('\\]')
    
    // But should contain the unescaped characters
    expect(savedData).toContain('O&M')
    expect(savedData).toContain('[')
    expect(savedData).toContain(']')
    
    // Next button should be available
    const nextButton = screen.queryByTestId('next-button')
    expect(nextButton).toBeTruthy()
    
    consoleSpy.mockRestore()
    unmount()
  }, 10000)

  it('should show clear error position when JSON has other issues', async () => {
    // JSON with escaped brackets AND a syntax error to test error reporting
    const brokenJSON = `{
"welcomePage": {
"id": "welcome",
"title": "Welcome",
"imageKeywords": \\["test"],
"badSyntax": "missing quote
}
}`

    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    fireEvent.change(textarea, { 
      target: { value: brokenJSON } 
    })

    // Should show error feedback
    await waitFor(() => {
      const error = screen.queryByText(/error/i) || 
                   screen.queryByText(/invalid/i) ||
                   screen.queryByText(/parse/i)
      expect(error).toBeTruthy()
    }, { timeout: 5000 })
    
    unmount()
  }, 8000)

  it('should handle JSON with \\& escape sequences specifically', async () => {
    const jsonWithAmpersandEscapes = `{
      "title": "Operations \\& Maintenance", 
      "department": "O\\&M Department",
      "topics": \\[
        {
          "content": "This covers O\\&M procedures for pipelines \\& safety."
        }
      ]
    }`

    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    fireEvent.change(textarea, { 
      target: { value: jsonWithAmpersandEscapes } 
    })

    // Should auto-fix and be valid
    await waitFor(() => {
      const success = screen.queryByText(/ready to import/i) || 
                     screen.queryByText(/automatically fixed/i) ||
                     screen.queryByText(/valid JSON/i)
      expect(success).toBeTruthy()
    }, { timeout: 5000 })
    
    // Check that the content was saved correctly
    expect(mockStorage.saveContent).toHaveBeenCalled()
    const savedData = mockStorage.saveContent.mock.calls[0][1]
    
    // Should not contain \\& escape sequences
    expect(savedData).not.toContain('\\&')
    expect(savedData).not.toContain('\\[')
    expect(savedData).not.toContain('\\]')
    
    // Should contain regular & characters
    expect(savedData).toContain('Operations & Maintenance')
    expect(savedData).toContain('O&M Department')
    expect(savedData).toContain('pipelines & safety')
    
    unmount()
  }, 8000)
})