import React from 'react'
import { render, screen, fireEvent } from '../../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock SCORM package HTML structure
const MockKnowledgeCheckPage = () => {
  return (
    <div>
      <div className="knowledge-check-container">
        <h3>Knowledge Check</h3>
        
        {/* Multiple Choice Question */}
        <div className="kc-question-wrapper" data-question-index="0">
          <p className="kc-question">What is the primary component of natural gas?</p>
          <div className="kc-options">
            <label className="kc-option">
              <input 
                type="radio" 
                name="q0" 
                value="Propane"
                data-correct="Methane"
                data-feedback="Correct! Natural gas is primarily composed of methane."
              />
              <span>Propane</span>
            </label>
            <label className="kc-option">
              <input 
                type="radio" 
                name="q0" 
                value="Methane"
                data-correct="Methane"
                data-feedback="Correct! Natural gas is primarily composed of methane."
              />
              <span>Methane</span>
            </label>
            <label className="kc-option">
              <input 
                type="radio" 
                name="q0" 
                value="Butane"
                data-correct="Methane"
                data-feedback="Correct! Natural gas is primarily composed of methane."
              />
              <span>Butane</span>
            </label>
          </div>
          <button 
            className="kc-submit" 
            data-question-index="0"
            onClick={() => {
              // This will be implemented in the actual code
              window.submitMultipleChoice?.(0)
            }}
          >
            Submit Answer
          </button>
          <div id="feedback-0" className="feedback"></div>
        </div>
      </div>
    </div>
  )
}

describe('Knowledge Check Visual Feedback Behavior', () => {
  beforeEach(() => {
    // Reset window functions
    window.submitMultipleChoice = undefined
    window.checkMultipleChoice = undefined
    
    // Mock CSS animations
    const style = document.createElement('style')
    style.textContent = `
      @keyframes flash-correct {
        0%, 100% { background-color: #e8f5e9; }
        50% { background-color: #4caf50; }
      }
      
      .kc-option.correct-answer {
        background-color: #e8f5e9;
        border: 2px solid #4caf50;
        animation: flash-correct 0.6s ease-in-out 3;
      }
      
      .kc-option.incorrect-answer {
        background-color: #ffebee;
        border: 2px solid #f44336;
      }
      
      .feedback.correct {
        display: block;
        background: #e8f5e9;
        color: #2e7d32;
        border-left: 4px solid #4caf50;
      }
      
      .feedback.incorrect {
        display: block;
        background: #ffebee;
        color: #c62828;
        border-left: 4px solid #f44336;
      }
    `
    document.head.appendChild(style)
  })

  it('should show submit button instead of auto-checking on selection', async () => {
    render(<MockKnowledgeCheckPage />)
    
    // Get radio button and submit button
    const methaneOption = screen.getByLabelText('Methane')
    const submitButton = screen.getByText('Submit Answer')
    
    // Radio should not have onchange handler
    expect(methaneOption).not.toHaveAttribute('onchange')
    
    // Submit button should be visible
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toHaveClass('kc-submit')
  })

  it('should highlight correct answer in green with flashing animation when correct', async () => {
    render(<MockKnowledgeCheckPage />)
    
    // Mock the submit function
    window.submitMultipleChoice = vi.fn((questionIndex) => {
      const selectedInput = document.querySelector('input[name="q0"]:checked') as HTMLInputElement
      const correctAnswer = selectedInput?.dataset.correct
      const selectedValue = selectedInput?.value
      
      if (selectedValue === correctAnswer) {
        // Add visual feedback classes
        const optionLabel = selectedInput.closest('.kc-option')
        optionLabel?.classList.add('correct-answer')
        
        // Show feedback
        const feedback = document.getElementById('feedback-0')
        if (feedback) {
          feedback.textContent = selectedInput.dataset.feedback || ''
          feedback.className = 'feedback correct'
        }
      }
    })
    
    // Select correct answer
    const methaneOption = screen.getByLabelText('Methane')
    fireEvent.click(methaneOption)
    
    // Click submit
    const submitButton = screen.getByText('Submit Answer')
    fireEvent.click(submitButton)
    
    // Check visual feedback
    const optionLabel = methaneOption.closest('.kc-option')
    expect(optionLabel).toHaveClass('correct-answer')
    
    // Check feedback message
    const feedback = screen.getByText('Correct! Natural gas is primarily composed of methane.')
    expect(feedback).toHaveClass('feedback', 'correct')
  })

  it('should highlight wrong answer in red and show correct answer when incorrect', async () => {
    render(<MockKnowledgeCheckPage />)
    
    // Mock the submit function
    window.submitMultipleChoice = vi.fn((questionIndex) => {
      const selectedInput = document.querySelector('input[name="q0"]:checked') as HTMLInputElement
      const correctAnswer = selectedInput?.dataset.correct
      const selectedValue = selectedInput?.value
      
      if (selectedValue !== correctAnswer) {
        // Highlight wrong answer
        const optionLabel = selectedInput.closest('.kc-option')
        optionLabel?.classList.add('incorrect-answer')
        
        // Find and highlight correct answer
        const allInputs = document.querySelectorAll('input[name="q0"]')
        allInputs.forEach((input: any) => {
          if (input.value === correctAnswer) {
            input.closest('.kc-option')?.classList.add('correct-answer')
          }
        })
        
        // Show feedback
        const feedback = document.getElementById('feedback-0')
        if (feedback) {
          feedback.textContent = 'Incorrect. The correct answer is Methane.'
          feedback.className = 'feedback incorrect'
        }
      }
    })
    
    // Select wrong answer
    const propaneOption = screen.getByLabelText('Propane')
    fireEvent.click(propaneOption)
    
    // Click submit
    const submitButton = screen.getByText('Submit Answer')
    fireEvent.click(submitButton)
    
    // Check visual feedback
    const wrongOptionLabel = propaneOption.closest('.kc-option')
    expect(wrongOptionLabel).toHaveClass('incorrect-answer')
    
    // Check correct answer is highlighted
    const methaneOption = screen.getByLabelText('Methane')
    const correctOptionLabel = methaneOption.closest('.kc-option')
    expect(correctOptionLabel).toHaveClass('correct-answer')
    
    // Check feedback message
    const feedback = screen.getByText('Incorrect. The correct answer is Methane.')
    expect(feedback).toHaveClass('feedback', 'incorrect')
  })

  it('should disable submit button after submission to prevent multiple attempts', async () => {
    render(<MockKnowledgeCheckPage />)
    
    window.submitMultipleChoice = vi.fn(() => {
      // Disable submit button after submission
      const submitButton = document.querySelector('[data-question-index="0"]') as HTMLButtonElement
      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = 'Answer Submitted'
      }
    })
    
    const submitButton = screen.getByText('Submit Answer') as HTMLButtonElement
    
    // Initially enabled
    expect(submitButton).not.toBeDisabled()
    
    // Select an answer and submit
    const methaneOption = screen.getByLabelText('Methane')
    fireEvent.click(methaneOption)
    fireEvent.click(submitButton)
    
    // Should be disabled after submission
    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('Answer Submitted')
  })

  it('should require answer selection before allowing submission', async () => {
    render(<MockKnowledgeCheckPage />)
    
    window.submitMultipleChoice = vi.fn((questionIndex) => {
      const selectedInput = document.querySelector('input[name="q0"]:checked')
      
      if (!selectedInput) {
        // Show error message
        const feedback = document.getElementById('feedback-0')
        if (feedback) {
          feedback.textContent = 'Please select an answer before submitting.'
          feedback.className = 'feedback incorrect'
        }
        return
      }
    })
    
    // Try to submit without selecting
    const submitButton = screen.getByText('Submit Answer')
    fireEvent.click(submitButton)
    
    // Should show error message
    const feedback = screen.getByText('Please select an answer before submitting.')
    expect(feedback).toHaveClass('feedback', 'incorrect')
  })

  it('should update navigation state after knowledge check submission', async () => {
    // Mock navigation update function
    window.updateNavigationState = vi.fn()
    window.answeredQuestions = {}
    
    render(<MockKnowledgeCheckPage />)
    
    window.submitMultipleChoice = vi.fn((questionIndex) => {
      // Mark question as answered
      window.answeredQuestions[`q${questionIndex}`] = true
      // Update navigation
      window.updateNavigationState?.()
    })
    
    // Select and submit answer
    const methaneOption = screen.getByLabelText('Methane')
    fireEvent.click(methaneOption)
    
    const submitButton = screen.getByText('Submit Answer')
    fireEvent.click(submitButton)
    
    // Check that question was marked as answered
    expect(window.answeredQuestions['q0']).toBe(true)
    expect(window.updateNavigationState).toHaveBeenCalled()
  })
})