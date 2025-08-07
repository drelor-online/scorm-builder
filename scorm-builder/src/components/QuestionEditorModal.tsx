import React, { useState, useEffect } from 'react'
import { KnowledgeCheckQuestion, AssessmentQuestion } from '../types/aiPrompt'
import { Modal, Button, Input, Flex } from './DesignSystem'
import { COLORS } from '../constants'

type Question = KnowledgeCheckQuestion | AssessmentQuestion

interface QuestionEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (question: Question) => void
  question: Question | null
  title?: string
}

const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  question,
  title = 'Edit Question'
}) => {
  const [editedQuestion, setEditedQuestion] = useState<Question | null>(null)
  const [selectedType, setSelectedType] = useState<'multiple-choice' | 'true-false' | 'fill-in-the-blank'>('multiple-choice')

  // Initialize edited question when modal opens or question changes
  useEffect(() => {
    if (question) {
      setEditedQuestion({ ...question })
      setSelectedType(question.type)
    } else if (isOpen && !question) {
      // Create a default question when adding new
      const defaultQuestion: Question = {
        id: `q-${Date.now()}`,
        type: selectedType,
        question: '',
        options: selectedType === 'multiple-choice' 
          ? ['Option A', 'Option B', 'Option C', 'Option D']
          : selectedType === 'true-false'
          ? ['True', 'False']
          : undefined,
        correctAnswer: selectedType === 'multiple-choice'
          ? 'Option A'
          : selectedType === 'true-false'
          ? 'True'
          : '',
        blank: selectedType === 'fill-in-the-blank' ? 'The answer is _____.' : undefined,
        feedback: { correct: '', incorrect: '' }
      }
      setEditedQuestion(defaultQuestion as Question)
    }
  }, [question, isOpen, selectedType])

  const handleSave = () => {
    if (editedQuestion) {
      onSave(editedQuestion)
      onClose()
    }
  }

  const handleCancel = () => {
    onClose()
  }

  const updateQuestion = (updates: Partial<Question>) => {
    if (editedQuestion) {
      setEditedQuestion({ ...editedQuestion, ...updates })
    }
  }

  const updateFeedback = (type: 'correct' | 'incorrect', value: string) => {
    if (editedQuestion) {
      setEditedQuestion({
        ...editedQuestion,
        feedback: {
          ...editedQuestion.feedback || { correct: '', incorrect: '' },
          [type]: value
        }
      })
    }
  }

  const updateOption = (index: number, value: string) => {
    if (editedQuestion && editedQuestion.type === 'multiple-choice' && editedQuestion.options) {
      const newOptions = [...editedQuestion.options]
      const oldOption = newOptions[index]
      newOptions[index] = value
      
      // If this was the correct answer, update it too
      let newCorrectAnswer = editedQuestion.correctAnswer
      if (editedQuestion.correctAnswer === oldOption) {
        newCorrectAnswer = value
      }
      
      setEditedQuestion({
        ...editedQuestion,
        options: newOptions,
        correctAnswer: newCorrectAnswer
      })
    }
  }

  if (!isOpen || !editedQuestion) {
    return null
  }

  // Handle type change for new questions
  const handleTypeChange = (newType: 'multiple-choice' | 'true-false' | 'fill-in-the-blank') => {
    setSelectedType(newType)
    if (!question && editedQuestion) {
      // Update the question structure based on new type
      const updatedQuestion: Question = {
        ...editedQuestion,
        type: newType,
        options: newType === 'multiple-choice' 
          ? ['Option A', 'Option B', 'Option C', 'Option D']
          : newType === 'true-false'
          ? ['True', 'False']
          : undefined,
        correctAnswer: newType === 'multiple-choice'
          ? 'Option A'
          : newType === 'true-false'
          ? 'True'
          : '',
        blank: newType === 'fill-in-the-blank' ? 'The answer is _____.' : undefined,
        question: editedQuestion.question || ''
      }
      setEditedQuestion(updatedQuestion as Question)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <>
        {/* Question Type Selector for new questions */}
        {!question && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label 
              htmlFor="question-type-select"
              style={{
                display: 'block',
                color: '#a1a1aa',
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}
            >
              Question Type
            </label>
            <select
              id="question-type-select"
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value as 'multiple-choice' | 'true-false' | 'fill-in-the-blank')}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '0.25rem',
                color: COLORS.text,
                fontSize: '1rem'
              }}
            >
              <option value="multiple-choice">Multiple Choice</option>
              <option value="true-false">True/False</option>
              <option value="fill-in-the-blank">Fill in the Blank</option>
            </select>
          </div>
        )}
        
        {/* Question Text - Different for fill-in-the-blank */}
        {editedQuestion.type !== 'fill-in-the-blank' && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="question-text" style={{
              display: 'block',
              color: '#a1a1aa',
              marginBottom: '0.5rem',
              fontSize: '0.875rem'
            }}>
              Question Text
            </label>
            <Input
              id="question-text"
              type="text"
              value={editedQuestion.question}
              onChange={(e) => updateQuestion({ question: e.target.value })}
              fullWidth
            />
          </div>
        )}
        
        {/* Fill-in-the-blank specific fields */}
        {editedQuestion.type === 'fill-in-the-blank' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="blank-text" style={{
                display: 'block',
                color: '#a1a1aa',
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}>
                Question with Blank (use _____ for the blank)
              </label>
              <Input
                id="blank-text"
                type="text"
                value={(editedQuestion as KnowledgeCheckQuestion).blank || ''}
                onChange={(e) => updateQuestion({ blank: e.target.value } as Partial<KnowledgeCheckQuestion>)}
                fullWidth
                placeholder="The capital of France is _____."
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="correct-answer-blank" style={{
                display: 'block',
                color: '#a1a1aa',
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}>
                Correct Answer
              </label>
              <Input
                id="correct-answer-blank"
                type="text"
                value={editedQuestion.correctAnswer}
                onChange={(e) => updateQuestion({ correctAnswer: e.target.value })}
                fullWidth
                placeholder="Paris"
              />
            </div>
          </>
        )}
        
        {/* Options for multiple choice */}
        {editedQuestion.type === 'multiple-choice' && editedQuestion.options && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                color: '#a1a1aa',
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}>
                Answer Options
              </label>
              {editedQuestion.options.map((option, idx) => (
                <div key={idx} style={{ marginBottom: '0.5rem' }}>
                  <Input
                    label={`Option ${idx + 1}`}
                    value={option}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    fullWidth
                  />
                </div>
              ))}
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="correct-answer" style={{
                display: 'block',
                color: '#a1a1aa',
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}>
                Correct Answer
              </label>
              <select
                id="correct-answer"
                aria-label="Correct Answer"
                value={editedQuestion.correctAnswer}
                onChange={(e) => updateQuestion({ correctAnswer: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: COLORS.background,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '0.25rem',
                  color: '#e4e4e7',
                  outline: 'none'
                }}
              >
                <option value="">Select correct answer</option>
                {editedQuestion.options.map((option, idx) => (
                  <option key={idx} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </>
        )}
        
        {/* True/False options */}
        {editedQuestion.type === 'true-false' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              color: '#a1a1aa',
              marginBottom: '0.5rem',
              fontSize: '0.875rem'
            }}>
              Correct Answer
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="trueFalse"
                  value="True"
                  checked={editedQuestion.correctAnswer?.toLowerCase() === 'true'}
                  onChange={(e) => updateQuestion({ correctAnswer: e.target.value })}
                  aria-label="True"
                />
                <span style={{ color: '#e4e4e7' }}>True</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="trueFalse"
                  value="False"
                  checked={editedQuestion.correctAnswer?.toLowerCase() === 'false'}
                  onChange={(e) => updateQuestion({ correctAnswer: e.target.value })}
                  aria-label="False"
                />
                <span style={{ color: '#e4e4e7' }}>False</span>
              </label>
            </div>
          </div>
        )}
        
        {/* Feedback */}
        <div style={{ marginBottom: '1rem' }}>
          <Input
            label="Correct Feedback"
            value={editedQuestion.feedback?.correct || ''}
            onChange={(e) => updateFeedback('correct', e.target.value)}
            fullWidth
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <Input
            label="Incorrect Feedback"
            value={editedQuestion.feedback?.incorrect || ''}
            onChange={(e) => updateFeedback('incorrect', e.target.value)}
            fullWidth
          />
        </div>
        
        {/* Action Buttons */}
        <Flex gap="medium" justify="end">
          <Button
            onClick={handleSave}
            variant="primary"
          >
            Save
          </Button>
          <Button
            onClick={handleCancel}
            variant="secondary"
          >
            Cancel
          </Button>
        </Flex>
      </>
    </Modal>
  )
}

export default QuestionEditorModal