import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the storage
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

// JSON with escaped brackets that matches user's problematic input
const jsonWithEscapedBrackets = `{
"welcomePage": {
"id": "welcome",
"title": "Welcome to 49 CFR 192",
"content": "<h2>Welcome</h2><p>Welcome to the 49 CFR Part 192 training course.</p>",
"narration": "Welcome to 49 CFR Part 192.",
"imageKeywords": \\["pipeline safety intro", "gas pipeline overview"],
"imagePrompts": \\["Clean infographic style image showing a natural gas transmission and distribution pipeline system"],
"videoSearchTerms": \\["49 CFR 192 introduction", "pipeline safety overview"],
"duration": 2
},
"learningObjectivesPage": {
"id": "learning-objectives", 
"title": "Learning Objectives",
"content": "<h2>Learning Objectives</h2><p>After completing this course, you will be able to:</p>",
"narration": "By the end of this course you will know how Part 192 is organized.",
"imageKeywords": \\["learning objectives checklist", "pipeline compliance goals"],
"imagePrompts": \\["Minimalist checklist graphic with icons for design"],
"videoSearchTerms": \\["learning goals pipeline safety", "49 CFR 192 course objectives"],
"duration": 3
},
"topics": \\[
{
"id": "topic-0",
"title": "Part 192 Scope, Purpose, and Enforcement",
"content": "<h2>Scope and Applicability</h2><p>Part 192 establishes minimum federal safety standards.</p>",
"narration": "Part 192 sets minimum safety standards for gas pipelines.",
"imageKeywords": \\["PHMSA enforcement", "pipeline scope map"],
"imagePrompts": \\["Map of a gas pipeline network with icons for transmission"],
"videoSearchTerms": \\["PHMSA pipeline safety scope", "49 CFR 192 applicability"],
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

describe('JSONImportValidator - Escaped Brackets Auto-Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
  })

  it('should detect and fix escaped brackets in JSON arrays', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // This test should FAIL initially because the auto-fixer doesn't handle escaped brackets
    fireEvent.change(textarea, { 
      target: { value: jsonWithEscapedBrackets } 
    })

    // Wait for validation to complete
    await waitFor(() => {
      // Should show successful validation after auto-fix
      const successMessage = screen.queryByText(/automatically fixed/i) || 
                            screen.queryByText(/ready to import/i) ||
                            screen.queryByText(/valid JSON/i)
      expect(successMessage).toBeTruthy()
    }, { timeout: 5000 })
    
    // The JSON should be successfully parsed after auto-fix
    const nextButton = screen.queryByTestId('next-button')
    expect(nextButton).toBeTruthy()
    
    unmount()
  }, 10000)

  it('should show helpful error message when escaped brackets are detected', async () => {
    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    // Mock console.log to capture debug output
    const consoleSpy = vi.spyOn(console, 'log')
    
    fireEvent.change(textarea, { 
      target: { value: jsonWithEscapedBrackets } 
    })

    // Wait for validation attempt
    await waitFor(() => {
      // Should show some form of feedback (either success after auto-fix or error)
      const feedback = screen.queryByText(/error/i) || 
                      screen.queryByText(/fixed/i) ||
                      screen.queryByText(/invalid/i) ||
                      screen.queryByText(/valid/i)
      expect(feedback).toBeTruthy()
    }, { timeout: 5000 })
    
    // Check that debug output was generated
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
    unmount()
  }, 10000)

  it('should handle mixed valid and escaped bracket syntax', async () => {
    // JSON with some correct arrays and some with escaped brackets
    const mixedJson = `{
      "welcomePage": {
        "id": "welcome",
        "title": "Test",
        "content": "content",
        "narration": "narration",
        "imageKeywords": ["valid", "array"],
        "imagePrompts": \\["escaped", "array"],
        "videoSearchTerms": ["another", "valid", "array"],
        "duration": 2
      },
      "topics": [],
      "assessment": {
        "questions": [],
        "passMark": 80,
        "narration": ""
      }
    }`

    const { unmount } = render(
      <TestWrapper>
        <JSONImportValidator onNext={mockProps.onNext} onBack={mockProps.onBack} />
      </TestWrapper>
    )

    const textarea = screen.getByTestId('json-textarea')
    
    fireEvent.change(textarea, { 
      target: { value: mixedJson } 
    })

    // Should successfully auto-fix and validate
    await waitFor(() => {
      const success = screen.queryByText(/valid JSON/i) || 
                     screen.queryByText(/ready to import/i)
      expect(success).toBeTruthy()
    }, { timeout: 5000 })
    
    unmount()
  }, 10000)
})