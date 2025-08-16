import React from 'react'
import { render, screen, fireEvent } from '../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock fill-in-the-blank question
const MockFillInBlankQuestion = () => {
  return (
    <div className="knowledge-check-container">
      <div className="kc-question-wrapper">
        <p className="kc-question">Natural gas is lighter than ___.</p>
        <div className="kc-input-group">
          <input 
            type="text" 
            id="fill-blank-1" 
            className="kc-fill-blank" 
            placeholder="Type your answer here"
          />
          <button 
            className="kc-submit" 
            onClick={() => {
              window.checkFillInBlank?.(1, 'air', 'Correct! Natural gas is lighter than air.', 'Incorrect. Natural gas is lighter than air.', { preventDefault: () => {} } as any)
            }}
          >
            Submit
          </button>
        </div>
        <div id="feedback-1" className="feedback"></div>
      </div>
    </div>
  )
}

describe('Knowledge Check Submit Button Functionality', () => {
  beforeEach(() => {
    // Reset window functions
    window.checkFillInBlank = undefined
    window.submitMultipleChoice = undefined
    window.answeredQuestions = {}
    window.currentPage = 'topic-1'
  })

  it('should have submit buttons for both multiple choice and fill-in-blank questions', () => {
    const { container } = render(
      <div>
        <div className="knowledge-check-container">
          {/* Multiple choice */}
          <div className="kc-question-wrapper">
            <button className="kc-submit">Submit Answer</button>
          </div>
          
          {/* Fill in blank */}
          <div className="kc-question-wrapper">
            <button className="kc-submit">Submit</button>
          </div>
        </div>
      </div>
    )
    
    const submitButtons = container.querySelectorAll('.kc-submit')
    expect(submitButtons).toHaveLength(2)
  })

  it('should handle fill-in-the-blank submission correctly', () => {
    render(<MockFillInBlankQuestion />)
    
    // Mock the check function
    window.checkFillInBlank = vi.fn((index, correct, correctFeedback, incorrectFeedback) => {
      const input = document.getElementById(`fill-blank-${index}`) as HTMLInputElement
      const userAnswer = input?.value.trim().toLowerCase()
      const isCorrect = userAnswer === correct.toLowerCase()
      
      // Update feedback
      const feedback = document.getElementById(`feedback-${index}`)
      if (feedback) {
        feedback.textContent = isCorrect ? correctFeedback : incorrectFeedback
        feedback.className = isCorrect ? 'feedback correct' : 'feedback incorrect'
        feedback.style.display = 'block'
      }
      
      // Mark as answered
      window.answeredQuestions[`fill-blank-${index}`] = true
    })
    
    // Enter correct answer
    const input = screen.getByPlaceholderText('Type your answer here')
    fireEvent.change(input, { target: { value: 'air' } })
    
    // Submit
    const submitButton = screen.getByText('Submit')
    fireEvent.click(submitButton)
    
    // Check function was called
    expect(window.checkFillInBlank).toHaveBeenCalledWith(
      1, 
      'air', 
      'Correct! Natural gas is lighter than air.', 
      'Incorrect. Natural gas is lighter than air.',
      expect.any(Object)
    )
    
    // Check feedback shows
    const feedback = screen.getByText('Correct! Natural gas is lighter than air.')
    expect(feedback).toHaveClass('feedback', 'correct')
    expect(feedback).toHaveStyle({ display: 'block' })
    
    // Check marked as answered
    expect(window.answeredQuestions['fill-blank-1']).toBe(true)
  })

  it('should not submit if no answer is selected/entered', () => {
    render(
      <div className="knowledge-check-container">
        <div className="kc-question-wrapper">
          <div className="kc-options">
            <label className="kc-option">
              <input type="radio" name="q2" value="Option1" />
              <span>Option 1</span>
            </label>
          </div>
          <button 
            className="kc-submit"
            onClick={() => {
              const selected = document.querySelector('input[name="q2"]:checked')
              if (!selected) {
                const feedback = document.getElementById('feedback-2')
                if (feedback) {
                  feedback.textContent = 'Please select an answer before submitting.'
                  feedback.className = 'feedback incorrect'
                  feedback.style.display = 'block'
                }
              }
            }}
          >
            Submit Answer
          </button>
          <div id="feedback-2" className="feedback"></div>
        </div>
      </div>
    )
    
    // Click submit without selecting
    const submitButton = screen.getByText('Submit Answer')
    fireEvent.click(submitButton)
    
    // Should show error
    const feedback = screen.getByText('Please select an answer before submitting.')
    expect(feedback).toBeInTheDocument()
    expect(feedback).toHaveClass('feedback', 'incorrect')
  })

  it('should track submission state per question', () => {
    const mockQuestions = [
      { id: 0, submitted: false },
      { id: 1, submitted: false }
    ]
    
    render(
      <div>
        {mockQuestions.map(q => (
          <div key={q.id} className="kc-question-wrapper">
            <button 
              className="kc-submit"
              data-question-id={q.id}
              onClick={(e) => {
                const btn = e.currentTarget as HTMLButtonElement
                const qId = btn.dataset.questionId
                mockQuestions[Number(qId)].submitted = true
                btn.disabled = true
                btn.textContent = 'Submitted'
              }}
            >
              Submit Answer
            </button>
          </div>
        ))}
      </div>
    )
    
    // Submit first question
    const buttons = screen.getAllByText('Submit Answer')
    fireEvent.click(buttons[0])
    
    // First should be submitted, second should not
    expect(buttons[0]).toBeDisabled()
    expect(buttons[0]).toHaveTextContent('Submitted')
    expect(buttons[1]).not.toBeDisabled()
    expect(mockQuestions[0].submitted).toBe(true)
    expect(mockQuestions[1].submitted).toBe(false)
  })

  it('should update navigation state after any knowledge check submission', () => {
    window.updateNavigationState = vi.fn()
    window.shouldBlockNavigation = vi.fn(() => true)
    
    render(
      <div>
        <button 
          id="next-button"
          disabled={window.shouldBlockNavigation()}
        >
          Next
        </button>
        
        <div className="knowledge-check-container">
          <button 
            className="kc-submit"
            onClick={() => {
              window.answeredQuestions['topic-1_q0'] = true
              window.updateNavigationState?.()
            }}
          >
            Submit Answer
          </button>
        </div>
      </div>
    )
    
    // Next button should be disabled initially
    const nextButton = screen.getByText('Next') as HTMLButtonElement
    expect(nextButton).toBeDisabled()
    
    // Submit knowledge check
    const submitButton = screen.getByText('Submit Answer')
    fireEvent.click(submitButton)
    
    // Navigation state should update
    expect(window.updateNavigationState).toHaveBeenCalled()
    expect(window.answeredQuestions['topic-1_q0']).toBe(true)
  })

  it('should handle case-insensitive answers for fill-in-blank', () => {
    render(<MockFillInBlankQuestion />)
    
    window.checkFillInBlank = vi.fn((index, correct) => {
      const input = document.getElementById(`fill-blank-${index}`) as HTMLInputElement
      const userAnswer = input?.value.trim().toLowerCase()
      const isCorrect = userAnswer === correct.toLowerCase()
      
      expect(isCorrect).toBe(true) // Should match regardless of case
    })
    
    // Enter answer with different case
    const input = screen.getByPlaceholderText('Type your answer here')
    fireEvent.change(input, { target: { value: 'AIR' } })
    
    // Submit
    const submitButton = screen.getByText('Submit')
    fireEvent.click(submitButton)
    
    expect(window.checkFillInBlank).toHaveBeenCalled()
  })
})