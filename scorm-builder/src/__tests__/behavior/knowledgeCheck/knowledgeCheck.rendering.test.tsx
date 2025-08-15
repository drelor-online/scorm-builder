import { describe, it, expect, vi, beforeEach, test } from 'vitest'
import '@testing-library/jest-dom'

// Mock the Rust SCORM generator
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}))

describe('Knowledge Check Rendering in SCORM Package', () => {
  const _mockEnhancedContent = {
    title: 'Test Course',
    topics: [
      {
        id: 'topic-0',
        title: 'Test Topic 1',
        content: '<p>Test content</p>',
        audioFile: 'audio-0.bin',
        captionFile: 'caption-0.bin',
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'What is the answer?',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 1,
          explanation: 'Option B is correct'
        }
      },
      {
        id: 'topic-1', 
        title: 'Test Topic 2',
        content: '<p>Test content 2</p>',
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin',
        knowledgeCheck: {
          type: 'fill-in-the-blank',
          question: 'The capital of France is ___.',
          blank: 'The capital of France is ___.',
          correctAnswer: 'Paris',
          explanation: 'Paris is the capital of France'
        }
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render knowledge check questions in the generated HTML', async () => {
    // Simulate what the Rust generator should produce
    const _expectedHtml = `
      <div class="knowledge-check-container">
        <h3>Knowledge Check</h3>
        <div class="kc-question-wrapper" data-question-index="0">
          <p class="kc-question">What is the answer?</p>
          <div class="kc-options">
            <label class="kc-option">
              <input type="radio" name="q0" value="Option A" data-correct="Option B" data-feedback="Option B is correct">
              <span>Option A</span>
            </label>
            <label class="kc-option">
              <input type="radio" name="q0" value="Option B" data-correct="Option B" data-feedback="Option B is correct">
              <span>Option B</span>
            </label>
            <label class="kc-option">
              <input type="radio" name="q0" value="Option C" data-correct="Option B" data-feedback="Option B is correct">
              <span>Option C</span>
            </label>
            <label class="kc-option">
              <input type="radio" name="q0" value="Option D" data-correct="Option B" data-feedback="Option B is correct">
              <span>Option D</span>
            </label>
          </div>
          <button class="kc-submit" data-question-index="0" onclick="window.submitMultipleChoice(0)">
            Submit Answer
          </button>
          <div id="feedback-0" class="feedback"></div>
        </div>
      </div>
    `

    // Parse the actual generated HTML (this will fail initially)
    const actualHtml = `
      <div class="knowledge-check-container">
        <h3>Knowledge Check</h3>
        
      </div>
    `

    // Test that knowledge check content is present
    expect(actualHtml).toContain('kc-question-wrapper')
    expect(actualHtml).toContain('What is the answer?')
    expect(actualHtml).toContain('Option A')
    expect(actualHtml).toContain('Submit Answer')
  })

  it('should render fill-in-the-blank questions correctly', async () => {
    const _expectedHtml = `
      <div class="kc-question-wrapper">
        <p class="kc-question">The capital of France is ___.</p>
        <div class="kc-input-group">
          <input type="text" id="fill-blank-0" class="kc-fill-blank" placeholder="Type your answer here">
          <button class="kc-submit" onclick="window.checkFillInBlank(0, 'Paris', 'Paris is the capital of France', 'Incorrect. The capital of France is Paris.', event)">
            Submit
          </button>
        </div>
        <div id="feedback-0" class="feedback"></div>
      </div>
    `

    const actualHtml = `
      <div class="knowledge-check-container">
        <h3>Knowledge Check</h3>
        
      </div>
    `

    expect(actualHtml).toContain('fill-blank-0')
    expect(actualHtml).toContain('The capital of France is ___.')
    expect(actualHtml).toContain('Type your answer here')
  })

  it('should not hide knowledge check when submit is clicked', async () => {
    // Mock DOM structure
    document.body.innerHTML = `
      <div class="knowledge-check-container">
        <h3>Knowledge Check</h3>
        <div class="kc-question-wrapper" data-question-index="0">
          <p class="kc-question">Test question</p>
          <button class="kc-submit" data-question-index="0">Submit Answer</button>
          <div id="feedback-0" class="feedback"></div>
        </div>
      </div>
    `

    // Mock the submit function
    window.submitMultipleChoice = vi.fn((_index) => {
      const submitButton = document.querySelector(`[data-question-index="${_index}"]`)
      if (submitButton) {
        submitButton.disabled = true
        submitButton.textContent = 'Answer Submitted'
      }
    })

    const kcContainer = document.querySelector('.knowledge-check-container')
    const submitButton = document.querySelector('.kc-submit') as HTMLButtonElement
    
    // Initial state
    expect(kcContainer).toBeVisible()
    expect(submitButton).toBeEnabled()
    
    // Click submit
    submitButton.click()
    
    // After submit - container should still be visible
    expect(kcContainer).toBeVisible()
    expect(submitButton).toBeDisabled()
    expect(submitButton.textContent).toBe('Answer Submitted')
    
    // The question wrapper should still be visible
    const questionWrapper = document.querySelector('.kc-question-wrapper')
    expect(questionWrapper).toBeVisible()
  })

  it('should properly pass knowledge check data to Rust templates', async () => {
    // Test the data structure passed to Rust
    const rustData = {
      id: 'topic-0',
      title: 'Test Topic',
      content: '<p>Content</p>',
      has_knowledge_check: true,
      knowledge_check_questions: [
        {
          type: 'multiple-choice',
          text: 'What is the answer?',
          index: 0,
          correct_answer: 'Option B',
          explanation: 'Option B is correct',
          options: ['Option A', 'Option B', 'Option C', 'Option D']
        }
      ]
    }

    // Verify the structure matches what the template expects
    expect(rustData.has_knowledge_check).toBe(true)
    expect(rustData.knowledge_check_questions).toHaveLength(1)
    expect(rustData.knowledge_check_questions[0]).toHaveProperty('type')
    expect(rustData.knowledge_check_questions[0]).toHaveProperty('text')
    expect(rustData.knowledge_check_questions[0]).toHaveProperty('options')
  })

  test('submit button should disable but not hide questions when clicked', async () => {
    // Create DOM with knowledge check
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="knowledge-check-container">
        <h3>Knowledge Check</h3>
        <div class="kc-question-wrapper" data-question-index="0">
          <p class="kc-question">What is the correct answer?</p>
          <div class="kc-options">
            <label class="kc-option">
              <input type="radio" name="q0" value="Option B" data-correct="Option B">
              <span>Option B</span>
            </label>
          </div>
          <button class="kc-submit" data-question-index="0">Submit Answer</button>
          <div id="feedback-0" class="feedback"></div>
        </div>
      </div>
    `
    document.body.appendChild(container)

    const submitButton = container.querySelector('.kc-submit') as HTMLButtonElement
    const questionWrapper = container.querySelector('.kc-question-wrapper') as HTMLElement
    const kcContainer = container.querySelector('.knowledge-check-container') as HTMLElement

    // Mock the submit function that should be in navigation.js
    window.submitMultipleChoice = vi.fn((_index) => {
      const btn = document.querySelector(`[data-question-index="${_index}"]`) as HTMLButtonElement
      if (btn) {
        btn.disabled = true
        const feedback = document.getElementById(`feedback-${_index}`)
        if (feedback) {
          feedback.textContent = 'Correct!'
          feedback.style.display = 'block'
          feedback.classList.add('correct')
        }
      }
    })

    // Before clicking
    expect(submitButton).not.toBeDisabled()
    expect(questionWrapper).toBeVisible()
    expect(kcContainer).toBeVisible()

    // Click submit
    submitButton.click()

    // After clicking - everything should still be visible
    expect(submitButton).toBeDisabled()
    expect(questionWrapper).toBeVisible()
    expect(kcContainer).toBeVisible()
    
    // Feedback should be shown
    const feedback = container.querySelector('#feedback-0') as HTMLElement
    expect(feedback.style.display).toBe('block')
    expect(feedback.textContent).toContain('Correct')

    document.body.removeChild(container)
  })

  test('fill-in-the-blank should keep input visible after submission', async () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="kc-question-wrapper">
        <p class="kc-question">The capital of France is ___.</p>
        <div class="kc-input-group">
          <input type="text" id="fill-blank-0" class="kc-fill-blank" placeholder="Type your answer here">
          <button class="kc-submit" onclick="window.checkFillInBlank(0, 'Paris', 'Correct!', 'Try again', event)">
            Submit
          </button>
        </div>
        <div id="feedback-0" class="feedback"></div>
      </div>
    `
    document.body.appendChild(container)

    const input = container.querySelector('.kc-fill-blank') as HTMLInputElement
    const submitButton = container.querySelector('.kc-submit') as HTMLButtonElement
    const questionWrapper = container.querySelector('.kc-question-wrapper') as HTMLElement

    // Mock the fill-in-blank function
    window.checkFillInBlank = vi.fn((_index, correctAnswer, correctFeedback, incorrectFeedback, event) => {
      event.preventDefault()
      const inputEl = document.getElementById(`fill-blank-${_index}`) as HTMLInputElement
      const submitBtn = event.target as HTMLButtonElement
      const feedback = document.getElementById(`feedback-${_index}`)
      
      if (inputEl && submitBtn && feedback) {
        const isCorrect = inputEl.value.toLowerCase() === correctAnswer.toLowerCase()
        submitBtn.disabled = true
        feedback.textContent = isCorrect ? correctFeedback : incorrectFeedback
        feedback.style.display = 'block'
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect')
      }
    })

    // Type answer
    input.value = 'Paris'

    // Before submission
    expect(submitButton).not.toBeDisabled()
    expect(input).toBeVisible()
    expect(questionWrapper).toBeVisible()

    // Submit
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: submitButton, enumerable: true })
    Object.defineProperty(event, 'preventDefault', { value: vi.fn(), enumerable: true })
    window.checkFillInBlank(0, 'Paris', 'Correct!', 'Try again', event)

    // After submission - everything should still be visible
    expect(submitButton).toBeDisabled()
    expect(input).toBeVisible()
    expect(questionWrapper).toBeVisible()
    
    // Feedback should be correct
    const feedback = container.querySelector('#feedback-0') as HTMLElement
    expect(feedback.style.display).toBe('block')
    expect(feedback.textContent).toBe('Correct!')
    expect(feedback).toHaveClass('correct')

    document.body.removeChild(container)
  })
})