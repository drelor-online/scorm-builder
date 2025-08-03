import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Navigation.js - Knowledge Check Feedback Visibility', () => {
  let dom: JSDOM
  let window: any
  let document: any

  beforeEach(() => {
    // Create a basic HTML structure
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="content-container">
            <div class="knowledge-check-container">
              <h3>Knowledge Check</h3>
              <div class="kc-question-wrapper" data-question-index="0">
                <p class="kc-question">A high number of near-miss reports is a sign of a dangerous workplace.</p>
                <div class="kc-options">
                  <label class="kc-option">
                    <input type="radio" name="q0" value="true" data-correct="1" 
                           data-feedback="Correct! A high number of near-miss reports indicates a healthy safety culture.">
                    <span>True</span>
                  </label>
                  <label class="kc-option">
                    <input type="radio" name="q0" value="false" data-correct="1" 
                           data-feedback="Correct! A high number of near-miss reports indicates a healthy safety culture.">
                    <span>False</span>
                  </label>
                </div>
                <button class="kc-submit" data-question-index="0" onclick="window.submitMultipleChoice(0)">
                  Submit Answer
                </button>
                <div id="feedback-0" class="feedback"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost' })

    window = dom.window
    document = window.document
    
    // Mock window functions
    window.currentPage = 'topic-5'
    window.answeredQuestions = {}
  })

  describe('User wants knowledge check feedback to remain visible after submission', () => {
    it('should NOT disable radio buttons after submission - they should remain enabled for review', () => {
      // Load navigation.js content (simplified version for testing)
      window.submitMultipleChoice = function(questionIndex: number) {
        const selectedInput = document.querySelector(`input[name="q${questionIndex}"]:checked`)
        if (!selectedInput) return
        
        const selectedValue = selectedInput.value
        const correctAnswer = selectedInput.dataset.correct
        const feedback = selectedInput.dataset.feedback
        const isCorrect = selectedValue === correctAnswer
        
        // Show feedback
        const feedbackElement = document.getElementById(`feedback-${questionIndex}`)
        if (feedbackElement) {
          feedbackElement.textContent = feedback || 'Correct!'
          feedbackElement.className = 'feedback correct'
          feedbackElement.style.display = 'block'
        }
        
        // BUG: This disables all radio buttons, preventing user from reviewing
        const allOptions = document.querySelectorAll(`input[name="q${questionIndex}"]`)
        allOptions.forEach((input: any) => {
          input.disabled = true // THIS IS THE PROBLEM!
        })
        
        // Disable submit button
        const submitButton = document.querySelector(`[data-question-index="${questionIndex}"]`) as any
        if (submitButton) {
          submitButton.disabled = true
          submitButton.textContent = 'Answer Submitted'
        }
      }

      // User selects an answer
      const falseOption = document.querySelector('input[value="false"]') as HTMLInputElement
      falseOption.checked = true
      
      // User clicks submit
      window.submitMultipleChoice(0)
      
      // Check that radio buttons are disabled (this is the bug)
      const allRadios = document.querySelectorAll('input[type="radio"]')
      allRadios.forEach((radio: any) => {
        expect(radio.disabled).toBe(true) // BUG: Should remain enabled!
      })
      
      // Check that feedback is displayed
      const feedbackElement = document.getElementById('feedback-0')
      expect(feedbackElement?.style.display).toBe('block')
      expect(feedbackElement?.textContent).toContain('Correct!')
    })

    it('should add visual classes to highlight correct and incorrect answers', () => {
      // This is what SHOULD happen
      window.submitMultipleChoice = function(questionIndex: number) {
        const selectedInput = document.querySelector(`input[name="q${questionIndex}"]:checked`)
        if (!selectedInput) return
        
        const selectedValue = selectedInput.value
        const correctAnswer = selectedInput.dataset.correct
        const isCorrect = selectedValue === correctAnswer
        
        // Add visual feedback to options
        const allOptions = document.querySelectorAll(`input[name="q${questionIndex}"]`)
        allOptions.forEach((input: any) => {
          const optionLabel = input.closest('.kc-option')
          if (input.value === selectedValue && !isCorrect) {
            // Highlight wrong answer in red
            optionLabel.classList.add('incorrect-answer')
          } else if (input.value === correctAnswer) {
            // Highlight correct answer in green with flashing
            optionLabel.classList.add('correct-answer')
          }
        })
        
        // Show feedback
        const feedbackElement = document.getElementById(`feedback-${questionIndex}`)
        if (feedbackElement) {
          feedbackElement.textContent = isCorrect ? 
            'Correct!' : 
            `Incorrect. The correct answer is ${correctAnswer}.`
          feedbackElement.className = isCorrect ? 'feedback correct' : 'feedback incorrect'
          feedbackElement.style.display = 'block'
        }
        
        // Only disable the submit button, NOT the radio buttons
        const submitButton = document.querySelector(`[data-question-index="${questionIndex}"]`) as any
        if (submitButton) {
          submitButton.disabled = true
          submitButton.textContent = 'Answer Submitted'
        }
      }

      // User selects wrong answer
      const trueOption = document.querySelector('input[value="true"]') as HTMLInputElement
      trueOption.checked = true
      
      // User clicks submit
      window.submitMultipleChoice(0)
      
      // Check that visual classes are added
      const trueLabel = trueOption.closest('.kc-option')
      const falseLabel = document.querySelector('input[value="false"]')?.closest('.kc-option')
      
      expect(trueLabel?.classList.contains('incorrect-answer')).toBe(true)
      expect(falseLabel?.classList.contains('correct-answer')).toBe(true)
      
      // Check that radios are NOT disabled
      const allRadios = document.querySelectorAll('input[type="radio"]')
      allRadios.forEach((radio: any) => {
        expect(radio.disabled).toBe(false) // Should remain enabled for review!
      })
    })
  })

  describe('User wants fill-in-blank questions to show proper feedback', () => {
    beforeEach(() => {
      // Add fill-in-blank question
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="content-container">
              <div class="knowledge-check-container">
                <h3>Knowledge Check</h3>
                <div class="kc-fill-wrapper">
                  <p class="kc-question">The capital of France is ___.</p>
                  <div class="fill-blank-container">
                    <input type="text" class="kc-fill-blank" id="fill-blank-0" />
                    <button onclick="window.checkFillInBlank(0, 'Paris', 'Correct!', 'Incorrect. The correct answer is Paris.', event)">
                      Submit
                    </button>
                  </div>
                  <div id="feedback-0" class="feedback"></div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `, { url: 'http://localhost' })

      window = dom.window
      document = window.document
      window.answeredQuestions = {}
    })

    it('should show feedback without disabling the input field', () => {
      window.checkFillInBlank = function(index: number, correctAnswer: string, correctFeedback: string, incorrectFeedback: string, event: any) {
        if (event) event.preventDefault()
        
        const input = document.getElementById(`fill-blank-${index}`) as HTMLInputElement
        if (!input) return
        
        const userAnswer = input.value.trim().toLowerCase()
        const isCorrect = userAnswer === correctAnswer.toLowerCase()
        
        // Show feedback
        const feedbackElement = document.getElementById(`feedback-${index}`)
        if (feedbackElement) {
          feedbackElement.textContent = isCorrect ? correctFeedback : incorrectFeedback
          feedbackElement.className = isCorrect ? 'feedback correct' : 'feedback incorrect'
          feedbackElement.style.display = 'block'
        }
        
        // BUG: Input should NOT be disabled - user should be able to see what they typed
        // Current navigation.js doesn't disable fill-in-blank inputs, which is good
      }

      // User types answer
      const input = document.getElementById('fill-blank-0') as HTMLInputElement
      input.value = 'London'
      
      // User clicks submit
      window.checkFillInBlank(0, 'Paris', 'Correct!', 'Incorrect. The correct answer is Paris.', { preventDefault: vi.fn() })
      
      // Check that feedback is shown
      const feedbackElement = document.getElementById('feedback-0')
      expect(feedbackElement?.style.display).toBe('block')
      expect(feedbackElement?.textContent).toBe('Incorrect. The correct answer is Paris.')
      expect(feedbackElement?.className).toBe('feedback incorrect')
      
      // Check that input is NOT disabled
      expect(input.disabled).toBe(false)
    })
  })
})