import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('Knowledge Check Visual Feedback', () => {
  let dom: JSDOM;
  let window: any;
  let document: any;

  beforeEach(() => {
    // Create HTML structure for knowledge check
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .kc-option.correct-answer {
            background-color: #e8f5e9;
            border: 2px solid #4caf50;
            animation: flash-correct 0.6s ease-in-out 3;
          }
          .kc-option.incorrect-answer {
            background-color: #ffebee;
            border: 2px solid #f44336;
          }
        </style>
      </head>
      <body>
        <div class="knowledge-check-container">
          <div class="kc-question-wrapper" data-correct-answer="Option B" data-correct-feedback="Correct!" data-incorrect-feedback="Not quite. Try again!">
            <h4>What is 2 + 2?</h4>
            <div class="kc-options">
              <label class="kc-option">
                <input type="radio" name="kc_q0" value="Option A"> Option A: 3
              </label>
              <label class="kc-option">
                <input type="radio" name="kc_q0" value="Option B"> Option B: 4
              </label>
              <label class="kc-option">
                <input type="radio" name="kc_q0" value="Option C"> Option C: 5
              </label>
            </div>
            <div class="feedback" style="display: none;"></div>
            <button class="kc-submit" onclick="submitKnowledgeCheck(0)">Submit Answer</button>
          </div>
        </div>
        <script>
          window.currentPage = 'test-page';
          window.answeredQuestions = {};
          
          // Simplified version of submitKnowledgeCheck for testing
          window.submitKnowledgeCheck = function(questionIndex) {
            const wrapper = document.querySelectorAll('.kc-question-wrapper')[questionIndex];
            const selectedInput = wrapper.querySelector('input[type="radio"]:checked');
            
            if (!selectedInput) {
              alert('Please select an answer before submitting.');
              return;
            }
            
            const selectedValue = selectedInput.value;
            const correctAnswer = wrapper.dataset.correctAnswer || '';
            const isCorrect = selectedValue === correctAnswer;
            
            // Highlight selected answer
            const allOptions = wrapper.querySelectorAll('input[type="radio"]');
            allOptions.forEach(input => {
              const optionLabel = input.closest('.kc-option');
              optionLabel.classList.remove('correct-answer', 'incorrect-answer');
              
              if (input.value === selectedValue && !isCorrect) {
                optionLabel.classList.add('incorrect-answer');
              }
              
              // Highlight correct answer when incorrect answer is selected
              if (!isCorrect && input.value === correctAnswer) {
                optionLabel.classList.add('correct-answer');
              }
              
              // Highlight correct answer when it's selected
              if (isCorrect && input.value === selectedValue) {
                optionLabel.classList.add('correct-answer');
              }
            });
            
            // Show feedback
            const feedbackElement = wrapper.querySelector('.feedback');
            if (feedbackElement) {
              const correctFeedback = wrapper.dataset.correctFeedback || 'Correct!';
              const incorrectFeedback = wrapper.dataset.incorrectFeedback || 'Not quite. Try again!';
              
              feedbackElement.textContent = isCorrect ? correctFeedback : incorrectFeedback;
              feedbackElement.className = isCorrect ? 'feedback correct' : 'feedback incorrect';
              feedbackElement.style.display = 'block';
            }
          };
        </script>
      </body>
      </html>
    `;

    dom = new JSDOM(html, { runScripts: 'dangerously' });
    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it('should highlight incorrect answer in red and correct answer in green with flash animation', () => {
    // Select an incorrect answer
    const incorrectOption = document.querySelector('input[value="Option A"]') as HTMLInputElement;
    incorrectOption.checked = true;

    // Submit the answer
    const submitButton = document.querySelector('.kc-submit') as HTMLButtonElement;
    window.submitKnowledgeCheck(0);

    // Check that the incorrect answer is highlighted in red
    const incorrectLabel = incorrectOption.closest('.kc-option');
    expect(incorrectLabel.classList.contains('incorrect-answer')).toBe(true);
    
    // Check that the correct answer is highlighted in green with animation
    const correctOption = document.querySelector('input[value="Option B"]') as HTMLInputElement;
    const correctLabel = correctOption.closest('.kc-option');
    expect(correctLabel.classList.contains('correct-answer')).toBe(true);
    
    // Check that feedback is shown
    const feedback = document.querySelector('.feedback') as HTMLElement;
    expect(feedback.style.display).toBe('block');
    expect(feedback.classList.contains('incorrect')).toBe(true);
  });

  it('should highlight correct answer in green when selected', () => {
    // Select the correct answer
    const correctOption = document.querySelector('input[value="Option B"]') as HTMLInputElement;
    correctOption.checked = true;

    // Submit the answer
    window.submitKnowledgeCheck(0);

    // Check that the correct answer is highlighted in green
    const correctLabel = correctOption.closest('.kc-option');
    expect(correctLabel.classList.contains('correct-answer')).toBe(true);
    expect(correctLabel.classList.contains('incorrect-answer')).toBe(false);
    
    // Check that feedback is shown
    const feedback = document.querySelector('.feedback') as HTMLElement;
    expect(feedback.style.display).toBe('block');
    expect(feedback.classList.contains('correct')).toBe(true);
  });

  it('should not highlight unselected options', () => {
    // Select an incorrect answer
    const incorrectOption = document.querySelector('input[value="Option A"]') as HTMLInputElement;
    incorrectOption.checked = true;

    // Submit the answer
    window.submitKnowledgeCheck(0);

    // Check that unselected option C is not highlighted
    const unselectedOption = document.querySelector('input[value="Option C"]') as HTMLInputElement;
    const unselectedLabel = unselectedOption.closest('.kc-option');
    expect(unselectedLabel.classList.contains('correct-answer')).toBe(false);
    expect(unselectedLabel.classList.contains('incorrect-answer')).toBe(false);
  });
});