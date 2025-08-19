import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock scrollIntoView to track when it gets called
const mockScrollIntoView = vi.fn()

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn().mockResolvedValue(undefined)
}

// Test data
const testCourseData = {
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration'
  },
  learningObjectivesPage: {
    id: 'objectives', 
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Objectives narration'
  },
  topics: [
    {
      id: 'topic1',
      title: 'Topic 1',
      content: 'Topic content',
      narration: 'Topic narration'
    }
  ],
  assessment: {
    questions: [
      {
        id: 'aq1',
        type: 'multiple-choice',
        question: 'Test question?',
        correctAnswer: 'A'
      }
    ]
  }
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <PersistentStorageProvider value={mockStorage}>
      <StepNavigationProvider>
        <UnsavedChangesProvider>
          {children}
        </UnsavedChangesProvider>
      </StepNavigationProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('JSONImportValidator Auto-Scroll Focus Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock scrollIntoView to not cause actual scrolling but track calls
    Element.prototype.scrollIntoView = mockScrollIntoView
    
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((callback) => {
      setTimeout(callback, 0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not trigger auto-scrolling when switching to tree view', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    render(
      <TestWrapper>
        <JSONImportValidator
          onNext={onNext}
          onBack={onBack}
        />
      </TestWrapper>
    )

    // Paste valid JSON to enable tree view
    const jsonInput = JSON.stringify(testCourseData, null, 2)
    
    const editorTextarea = screen.getByRole('textbox')
    fireEvent.change(editorTextarea, { target: { value: jsonInput } })

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/Ready to Import/)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Clear any scrollIntoView calls that might have happened during setup
    mockScrollIntoView.mockClear()

    // Switch to tree view
    const toggleButton = screen.getByTestId('toggle-view-button')
    fireEvent.click(toggleButton)

    // Wait for tree view to appear
    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument()
    })

    // Wait a bit more to ensure any delayed scroll calls would have happened
    await new Promise(resolve => setTimeout(resolve, 200))

    // scrollIntoView should NOT have been called due to focus behavior
    expect(mockScrollIntoView).not.toHaveBeenCalled()
  })

  it('should focus tree view without causing auto-scroll', async () => {
    const onNext = vi.fn()
    const onBack = vi.fn()

    // Track focus calls
    const mockFocus = vi.fn()
    
    render(
      <TestWrapper>
        <JSONImportValidator
          onNext={onNext}
          onBack={onBack}
        />
      </TestWrapper>
    )

    const jsonInput = JSON.stringify(testCourseData, null, 2)
    
    const editorTextarea = screen.getByRole('textbox')
    fireEvent.change(editorTextarea, { target: { value: jsonInput } })

    await waitFor(() => {
      expect(screen.getByText(/Ready to Import/)).toBeInTheDocument()
    }, { timeout: 5000 })

    mockScrollIntoView.mockClear()

    // Mock focus on elements to prevent auto-scroll
    const originalFocus = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function(options) {
      mockFocus(this, options)
      // Don't call the original focus to prevent auto-scroll
    }

    const toggleButton = screen.getByTestId('toggle-view-button')
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument()
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    // focus() should have been called (that's expected for accessibility)
    expect(mockFocus).toHaveBeenCalled()
    
    // But scrollIntoView should NOT have been called
    expect(mockScrollIntoView).not.toHaveBeenCalled()

    // Restore original focus
    HTMLElement.prototype.focus = originalFocus
  })
})