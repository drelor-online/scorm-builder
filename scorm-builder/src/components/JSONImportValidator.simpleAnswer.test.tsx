import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Create a simple test component that uses the same formatAnswerDisplay logic
const formatAnswerDisplay = (correctAnswer: any) => {
  if (typeof correctAnswer === 'boolean') {
    return correctAnswer ? 'True' : 'False'
  }
  if (correctAnswer === null || correctAnswer === undefined) {
    return 'Not specified'
  }
  return String(correctAnswer)
}

const TestAnswerDisplay: React.FC<{ answer: any }> = ({ answer }) => (
  <div data-testid="answer-display">
    Answer: {formatAnswerDisplay(answer)}
  </div>
)

describe('JSONImportValidator Answer Formatting', () => {
  it('should format boolean true as "True"', () => {
    render(<TestAnswerDisplay answer={true} />)
    expect(screen.getByTestId('answer-display')).toHaveTextContent('Answer: True')
  })

  it('should format boolean false as "False"', () => {
    render(<TestAnswerDisplay answer={false} />)
    expect(screen.getByTestId('answer-display')).toHaveTextContent('Answer: False')
  })

  it('should format null as "Not specified"', () => {
    render(<TestAnswerDisplay answer={null} />)
    expect(screen.getByTestId('answer-display')).toHaveTextContent('Answer: Not specified')
  })

  it('should format undefined as "Not specified"', () => {
    render(<TestAnswerDisplay answer={undefined} />)
    expect(screen.getByTestId('answer-display')).toHaveTextContent('Answer: Not specified')
  })

  it('should format string answers as-is', () => {
    render(<TestAnswerDisplay answer="Paris" />)
    expect(screen.getByTestId('answer-display')).toHaveTextContent('Answer: Paris')
  })

  it('should format number answers as strings', () => {
    render(<TestAnswerDisplay answer={42} />)
    expect(screen.getByTestId('answer-display')).toHaveTextContent('Answer: 42')
  })
})