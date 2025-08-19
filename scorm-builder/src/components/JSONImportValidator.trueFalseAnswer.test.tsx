import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn().mockResolvedValue(null),
  saveContent: vi.fn().mockResolvedValue(undefined)
}

// Test data with true/false questions
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
      narration: 'Topic narration',
      knowledgeCheck: {
        questions: [
          {
            id: 'q1',
            type: 'true-false',
            question: 'Is this statement true?',
            correctAnswer: true
          },
          {
            id: 'q2', 
            type: 'true-false',
            question: 'Is this statement false?',
            correctAnswer: false
          }
        ]
      }
    }
  ],
  assessment: {
    questions: [
      {
        id: 'aq1',
        type: 'true-false',
        question: 'Assessment true/false question?',
        correctAnswer: true
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

describe('JSONImportValidator True/False Answer Display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display true/false answers correctly in tree view', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    // Paste the test JSON data
    const jsonInput = JSON.stringify(testCourseData, null, 2)
    
    // Find the JSON editor and paste content
    const editorTextarea = screen.getByRole('textbox')
    fireEvent.change(editorTextarea, { target: { value: jsonInput } })

    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText(/Ready to Import/)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Switch to tree view if not already there
    const treeView = screen.queryByTestId('json-tree-view')
    if (!treeView) {
      const toggleButton = screen.getByTestId('toggle-view-button')
      fireEvent.click(toggleButton)
    }

    // Wait for tree view to appear
    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument()
    })

    // Expand topics node
    const topicsNode = screen.getByTestId('json-tree-node-topics')
    fireEvent.click(topicsNode)

    // Expand first topic
    const topic1Node = screen.getByTestId('json-tree-node-topic-topic1')
    fireEvent.click(topic1Node)

    // Check that true/false answers are displayed correctly
    // Should show "Answer: True" and "Answer: False", not just "Answer:"
    await waitFor(() => {
      const answerElements = screen.getAllByText(/Answer: /)
      expect(answerElements.length).toBeGreaterThan(0)
      
      // Look for true/false answers specifically
      const trueAnswer = screen.getByText('Answer: True')
      const falseAnswer = screen.getByText('Answer: False')
      
      expect(trueAnswer).toBeInTheDocument()
      expect(falseAnswer).toBeInTheDocument()
    })

    // Also check assessment questions
    const assessmentNode = screen.getByTestId('json-tree-node-assessment')
    fireEvent.click(assessmentNode)

    await waitFor(() => {
      const assessmentTrueAnswer = screen.getByText('Answer: True')
      expect(assessmentTrueAnswer).toBeInTheDocument()
    })
  })

  it('should fail before fix - true/false answers showing as empty', async () => {
    render(
      <TestWrapper>
        <JSONImportValidator
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    const jsonInput = JSON.stringify(testCourseData, null, 2)
    
    const editorTextarea = screen.getByRole('textbox')
    fireEvent.change(editorTextarea, { target: { value: jsonInput } })

    await waitFor(() => {
      expect(screen.getByText(/Ready to Import/)).toBeInTheDocument()
    }, { timeout: 3000 })

    const treeView = screen.queryByTestId('json-tree-view')
    if (!treeView) {
      const toggleButton = screen.getByTestId('toggle-view-button')
      fireEvent.click(toggleButton)
    }

    await waitFor(() => {
      expect(screen.getByTestId('json-tree-view')).toBeInTheDocument()
    })

    const topicsNode = screen.getByTestId('json-tree-node-topics')
    fireEvent.click(topicsNode)

    const topic1Node = screen.getByTestId('json-tree-node-topic-topic1')
    fireEvent.click(topic1Node)

    // This test should fail initially - we expect to find "Answer: " without the actual value
    // showing that boolean values are not being converted to proper display strings
    await waitFor(() => {
      const answerTexts = screen.getAllByText(/Answer: /)
      
      // Check if any answer text contains just "Answer: " without a value
      const emptyAnswers = answerTexts.filter(el => 
        el.textContent === 'Answer: ' || 
        el.textContent === 'Answer: undefined' ||
        el.textContent === 'Answer: null'
      )
      
      // Before fix, we expect to find empty answers
      expect(emptyAnswers.length).toBeGreaterThan(0)
    })
  })
})