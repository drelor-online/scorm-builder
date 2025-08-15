/**
 * QuestionEditor - Consolidated Test Suite
 * 
 * This file consolidates QuestionEditor tests from multiple separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - QuestionEditorModal.test.tsx (main question editor functionality)
 * - QuestionEditorModal.fillInBlank.test.tsx (fill-in-the-blank specific tests)
 * 
 * Test Categories:
 * - Multiple Choice question editing
 * - True/False question editing
 * - Fill-in-the-blank question editing
 * - Modal behavior and interactions
 * - Feedback editing
 * - Options editing and validation
 * - SCORM generation compatibility
 * - Error handling and edge cases
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import QuestionEditorModal from '../QuestionEditorModal'
import { KnowledgeCheckQuestion, AssessmentQuestion } from '../../types/aiPrompt'

describe('QuestionEditor - Consolidated Test Suite', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Multiple Choice Questions', () => {
    const multipleChoiceQuestion: KnowledgeCheckQuestion = {
      id: 'q-1',
      type: 'multiple-choice',
      question: 'What is 2 + 2?',
      options: ['3', '4', '5'],
      correctAnswer: '4',
      feedback: {
        correct: 'Great job!',
        incorrect: 'Try again'
      }
    }

    it('should render multiple choice question correctly', () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={multipleChoiceQuestion}
          title="Edit Knowledge Check Question"
        />
      )

      expect(screen.getByDisplayValue('What is 2 + 2?')).toBeInTheDocument()
      // Use getAllByDisplayValue for options that appear in both input and select
      const threeElements = screen.getAllByDisplayValue('3')
      expect(threeElements.length).toBeGreaterThan(0)
      const fourElements = screen.getAllByDisplayValue('4')
      expect(fourElements.length).toBeGreaterThan(0)
      const fiveElements = screen.getAllByDisplayValue('5')
      expect(fiveElements.length).toBeGreaterThan(0)
      expect(screen.getByDisplayValue('Great job!')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Try again')).toBeInTheDocument()
    })

    it('should handle editing multiple choice question text', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={multipleChoiceQuestion}
          title="Edit Question"
        />
      )

      const questionInput = screen.getByDisplayValue('What is 2 + 2?')
      fireEvent.change(questionInput, { target: { value: 'What is 3 + 3?' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          ...multipleChoiceQuestion,
          question: 'What is 3 + 3?'
        })
      })
    })

    it('should handle editing individual options', async () => {
      const mcQuestion: KnowledgeCheckQuestion = {
        id: 'q-6',
        type: 'multiple-choice',
        question: 'Choose one',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option B',
        feedback: {
          correct: 'Yes',
          incorrect: 'No'
        }
      }

      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={mcQuestion}
          title="Edit Question"
        />
      )

      // Get all instances and use the input field (first one)
      const optionBElements = screen.getAllByDisplayValue('Option B')
      const optionBInput = optionBElements[0] as HTMLInputElement
      fireEvent.change(optionBInput, { target: { value: 'New Option B' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          ...mcQuestion,
          options: ['Option A', 'New Option B', 'Option C', 'Option D'],
          correctAnswer: 'New Option B' // Should update if it was the correct answer
        })
      })
    })

    it('should update correct answer dropdown when options change', async () => {
      const mcQuestion: KnowledgeCheckQuestion = {
        id: 'q-7',
        type: 'multiple-choice',
        question: 'Choose one',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option B',
        feedback: {
          correct: 'Yes',
          incorrect: 'No'
        }
      }

      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={mcQuestion}
          title="Edit Question"
        />
      )

      // Find the correct answer dropdown
      const correctAnswerSelect = screen.getByLabelText('Correct Answer') as HTMLSelectElement
      expect(correctAnswerSelect.value).toBe('Option B')

      // Change an option - get all instances and use the input field
      const optionAElements = screen.getAllByDisplayValue('Option A')
      const optionAInput = optionAElements[0] as HTMLInputElement
      fireEvent.change(optionAInput, { target: { value: 'Modified A' } })

      // Check that dropdown options updated
      await waitFor(() => {
        const options = Array.from(correctAnswerSelect.options).map(opt => opt.value)
        expect(options).toContain('Modified A')
        expect(options).not.toContain('Option A')
      })
    })
  })

  describe('True/False Questions', () => {
    const trueFalseQuestion: AssessmentQuestion = {
      id: 'q-2',
      type: 'true-false',
      question: 'The sky is blue',
      correctAnswer: 'True',
      feedback: {
        correct: 'Correct!',
        incorrect: 'Incorrect'
      }
    }

    it('should render true/false question correctly', () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={trueFalseQuestion}
          title="Edit Assessment Question"
        />
      )

      expect(screen.getByDisplayValue('The sky is blue')).toBeInTheDocument()
      const trueRadio = screen.getByLabelText('True') as HTMLInputElement
      expect(trueRadio.checked).toBe(true)
      const falseRadio = screen.getByLabelText('False') as HTMLInputElement
      expect(falseRadio.checked).toBe(false)
    })

    it('should handle toggling true/false answer', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={trueFalseQuestion}
          title="Edit Question"
        />
      )

      const falseRadio = screen.getByLabelText('False')
      fireEvent.click(falseRadio)

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          ...trueFalseQuestion,
          correctAnswer: 'False'
        })
      })
    })
  })

  describe('Fill-in-the-blank Questions', () => {
    const fillInBlankQuestion: KnowledgeCheckQuestion = {
      id: 'q-3',
      type: 'fill-in-the-blank',
      question: 'Fill in the blank question',
      blank: 'The capital of France is _____.',
      correctAnswer: 'Paris',
      feedback: {
        correct: 'Excellent!',
        incorrect: 'Not quite'
      }
    }

    it('should render fill-in-the-blank question correctly', () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={fillInBlankQuestion}
          title="Edit Question"
        />
      )

      expect(screen.getByDisplayValue('The capital of France is _____.')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Paris')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Excellent!')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Not quite')).toBeInTheDocument()
      
      // Should not show regular question field for fill-in-blank
      expect(screen.queryByDisplayValue('Fill in the blank question')).toBeFalsy()
    })

    it('should handle editing fill-in-the-blank answer', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={fillInBlankQuestion}
          title="Edit Question"
        />
      )

      const answerInput = screen.getByDisplayValue('Paris')
      fireEvent.change(answerInput, { target: { value: 'London' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          ...fillInBlankQuestion,
          correctAnswer: 'London'
        })
      })
    })

    it('should set both blank and question fields for new fill-in-the-blank questions', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Add Question"
        />
      )

      // Select fill-in-the-blank type
      const typeSelect = screen.getByLabelText(/question type/i)
      fireEvent.change(typeSelect, { target: { value: 'fill-in-the-blank' } })

      // Wait for the blank input to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/question with blank/i)).toBeInTheDocument()
      })

      // Enter a fill-in-the-blank question
      const blankInput = screen.getByLabelText(/question with blank/i)
      const testQuestion = 'The capital of France is _____.'
      fireEvent.change(blankInput, { target: { value: testQuestion } })

      // Enter the correct answer
      const answerInput = screen.getByLabelText(/correct answer/i)
      fireEvent.change(answerInput, { target: { value: 'Paris' } })

      // Save the question
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      // Check that onSave was called with the correct data
      expect(mockOnSave).toHaveBeenCalledTimes(1)
      const savedQuestion = mockOnSave.mock.calls[0][0] as KnowledgeCheckQuestion

      expect(savedQuestion.type).toBe('fill-in-the-blank')
      expect(savedQuestion.blank).toBe(testQuestion)
      expect(savedQuestion.question).toBe(testQuestion) // Both fields should be set
      expect(savedQuestion.correctAnswer).toBe('Paris')
    })

    it('should handle fill-in-the-blank questions correctly for SCORM generation', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Add Question"
        />
      )

      // Select fill-in-the-blank type
      const typeSelect = screen.getByLabelText(/question type/i)
      fireEvent.change(typeSelect, { target: { value: 'fill-in-the-blank' } })

      // Wait for the blank input to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/question with blank/i)).toBeInTheDocument()
      })

      // Enter a fill-in-the-blank question
      const blankInput = screen.getByLabelText(/question with blank/i)
      fireEvent.change(blankInput, { target: { value: 'Safety gear includes _____.' } })

      // Enter the correct answer
      const answerInput = screen.getByLabelText(/correct answer/i)
      fireEvent.change(answerInput, { target: { value: 'helmet' } })

      // Save the question
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      const savedQuestion = mockOnSave.mock.calls[0][0] as KnowledgeCheckQuestion

      // Simulate what rustScormGenerator expects (line 1112-1114)
      // It checks: if (!q.question && !(q as any).text && !(q as any).blank)
      // For the SCORM generator to work, at least one of these must be present
      const hasRequiredField = savedQuestion.question || 
                              (savedQuestion as any).text || 
                              (savedQuestion as any).blank

      expect(hasRequiredField).toBeTruthy()
      
      // More specifically, the question field should be set for consistency
      expect(savedQuestion.question).toBeTruthy()
      expect(savedQuestion.question).not.toBe('')
    })
  })

  describe('Modal Behavior and Interactions', () => {
    const sampleQuestion: KnowledgeCheckQuestion = {
      id: 'q-4',
      type: 'multiple-choice',
      question: 'Sample question',
      options: ['A', 'B'],
      correctAnswer: 'A',
      feedback: {
        correct: 'Good',
        incorrect: 'Bad'
      }
    }

    it('should not render when isOpen is false', () => {
      const { container } = render(
        <QuestionEditorModal
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={sampleQuestion}
          title="Edit Question"
        />
      )

      expect(container.firstChild).toBeFalsy()
    })

    it('should call onClose when Cancel button is clicked', () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={sampleQuestion}
          title="Edit Question"
        />
      )

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should handle null question gracefully', () => {
      const { container } = render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Edit Question"
        />
      )

      // Should render modal for creating new question when question is null
      expect(screen.getByText('Edit Question')).toBeInTheDocument()
    })

    it('should display correct modal title', () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={sampleQuestion}
          title="Custom Question Editor Title"
        />
      )

      expect(screen.getByText('Custom Question Editor Title')).toBeInTheDocument()
    })
  })

  describe('Feedback Editing', () => {
    const questionWithFeedback: KnowledgeCheckQuestion = {
      id: 'q-5',
      type: 'true-false',
      question: 'Testing feedback',
      correctAnswer: 'True',
      feedback: {
        correct: 'Initial correct',
        incorrect: 'Initial incorrect'
      }
    }

    it('should handle editing feedback messages', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={questionWithFeedback}
          title="Edit Question"
        />
      )

      const correctFeedback = screen.getByDisplayValue('Initial correct')
      fireEvent.change(correctFeedback, { target: { value: 'Updated correct' } })

      const incorrectFeedback = screen.getByDisplayValue('Initial incorrect')
      fireEvent.change(incorrectFeedback, { target: { value: 'Updated incorrect' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          ...questionWithFeedback,
          feedback: {
            correct: 'Updated correct',
            incorrect: 'Updated incorrect'
          }
        })
      })
    })

    it('should handle questions without feedback', () => {
      const questionNoFeedback = {
        ...questionWithFeedback,
        feedback: undefined
      }

      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={questionNoFeedback}
          title="Edit Question"
        />
      )

      // Should render empty feedback fields
      const feedbackInputs = screen.getAllByLabelText(/feedback/i)
      feedbackInputs.forEach(input => {
        expect((input as HTMLInputElement).value).toBe('')
      })
    })

    it('should preserve feedback when editing other fields', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={questionWithFeedback}
          title="Edit Question"
        />
      )

      // Change only the question text
      const questionInput = screen.getByDisplayValue('Testing feedback')
      fireEvent.change(questionInput, { target: { value: 'Updated question text' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          ...questionWithFeedback,
          question: 'Updated question text',
          feedback: {
            correct: 'Initial correct',
            incorrect: 'Initial incorrect'
          }
        })
      })
    })
  })

  describe('Question Type Switching', () => {
    it('should handle switching between question types', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Add Question"
        />
      )

      // Start with multiple choice
      const typeSelect = screen.getByLabelText(/question type/i)
      fireEvent.change(typeSelect, { target: { value: 'multiple-choice' } })

      // Should show options inputs
      await waitFor(() => {
        expect(screen.getByLabelText(/option 1/i)).toBeInTheDocument()
      })

      // Switch to true/false
      fireEvent.change(typeSelect, { target: { value: 'true-false' } })

      // Should show true/false radio buttons
      await waitFor(() => {
        expect(screen.getByLabelText('True')).toBeInTheDocument()
        expect(screen.getByLabelText('False')).toBeInTheDocument()
      })

      // Switch to fill-in-the-blank
      fireEvent.change(typeSelect, { target: { value: 'fill-in-the-blank' } })

      // Should show blank input
      await waitFor(() => {
        expect(screen.getByLabelText(/question with blank/i)).toBeInTheDocument()
      })
    })
  })

  describe('Validation and Error Handling', () => {
    it('should handle saving with minimal required fields', async () => {
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Add Question"
        />
      )

      // Select true/false type (simplest)
      const typeSelect = screen.getByLabelText(/question type/i)
      fireEvent.change(typeSelect, { target: { value: 'true-false' } })

      // Enter minimal required data
      const questionInput = screen.getByLabelText(/question text/i)
      fireEvent.change(questionInput, { target: { value: 'Is this a test?' } })

      // Save button should be enabled
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'true-false',
            question: 'Is this a test?',
            correctAnswer: 'True' // Default value
          })
        )
      })
    })

    it('should handle long question text gracefully', async () => {
      const longQuestion = 'This is a very long question text that might cause issues with layout or validation. '.repeat(10)
      
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Add Question"
        />
      )

      const typeSelect = screen.getByLabelText(/question type/i)
      fireEvent.change(typeSelect, { target: { value: 'true-false' } })

      const questionInput = screen.getByLabelText(/question text/i)
      fireEvent.change(questionInput, { target: { value: longQuestion } })

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            question: longQuestion
          })
        )
      })
    })

    it('should handle special characters in question text', async () => {
      const specialCharQuestion = 'What is 2 + 2? (Hint: It\'s not "five" & it\'s > 3)'
      
      render(
        <QuestionEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          question={null}
          title="Add Question"
        />
      )

      const typeSelect = screen.getByLabelText(/question type/i)
      fireEvent.change(typeSelect, { target: { value: 'true-false' } })

      const questionInput = screen.getByLabelText(/question text/i)
      fireEvent.change(questionInput, { target: { value: specialCharQuestion } })

      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            question: specialCharQuestion
          })
        )
      })
    })
  })
})