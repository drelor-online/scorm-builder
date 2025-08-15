import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Assessment Score Calculation', () => {
  let dom: JSDOM;
  let window: any;
  let document: any;

  beforeEach(() => {
    // Create HTML structure for assessment
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <div id="assessment-page">
          <div class="question-container" data-question-index="0">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q0" value="Option A"> A
              </label>
              <label class="option">
                <input type="radio" name="q0" value="Option B"> B
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="1">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q1" value="Option C"> C
              </label>
              <label class="option">
                <input type="radio" name="q1" value="Option D"> D
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="2">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q2" value="Option E"> E
              </label>
              <label class="option">
                <input type="radio" name="q2" value="Option F"> F
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="3">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q3" value="Option G"> G
              </label>
              <label class="option">
                <input type="radio" name="q3" value="Option H"> H
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="4">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q4" value="Option I"> I
              </label>
              <label class="option">
                <input type="radio" name="q4" value="Option J"> J
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="5">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q5" value="Option K"> K
              </label>
              <label class="option">
                <input type="radio" name="q5" value="Option L"> L
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="6">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q6" value="Option M"> M
              </label>
              <label class="option">
                <input type="radio" name="q6" value="Option N"> N
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="7">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q7" value="Option O"> O
              </label>
              <label class="option">
                <input type="radio" name="q7" value="Option P"> P
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="8">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q8" value="Option Q"> Q
              </label>
              <label class="option">
                <input type="radio" name="q8" value="Option R"> R
              </label>
            </div>
          </div>
          <div class="question-container" data-question-index="9">
            <div class="question-wrapper">
              <label class="option">
                <input type="radio" name="q9" value="Option S"> S
              </label>
              <label class="option">
                <input type="radio" name="q9" value="Option T"> T
              </label>
            </div>
          </div>
          <button class="submit-assessment">Submit Assessment</button>
          <div id="assessment-results" style="display: none;">
            <span id="score-percentage"></span>
          </div>
        </div>
        <script>
          // Mock alert
          window.alert = function(msg) { console.log('Alert:', msg); };
          
          // Mock SCORM API
          window.API = {
            LMSSetValue: function(key, value) {
              // Track specifically the score.raw value
              if (key === 'cmi.core.score.raw') {
                window.scoreRawValue = value;
              }
              window.lastSetValue = { key, value };
              console.log('[SCORM API] LMSSetValue:', key, '=', value);
              return 'true';
            },
            LMSCommit: function() { return 'true'; },
            LMSGetValue: function() { return ''; }
          };
          
          // Setup assessment data
          window.assessmentData = { attempts: 0, scores: [] };
          window.passingScore = 80;
          
          // Create questions array with correct answers
          window.assessmentQuestions = [
            { correct: 'Option A' },
            { correct: 'Option C' },
            { correct: 'Option E' },
            { correct: 'Option G' },
            { correct: 'Option I' },
            { correct: 'Option K' },
            { correct: 'Option M' },
            { correct: 'Option O' },
            { correct: 'Option Q' },
            { correct: 'Option S' }
          ];
          
          // Simplified submitAssessment function
          window.submitAssessment = function() {
            console.log('[SCORM Navigation] Submitting assessment');
            
            const questions = document.querySelectorAll('.question-container');
            let score = 0;
            let answered = 0;
            const passingScore = 80;
            const currentAnswers = {};
            
            window.assessmentData.attempts++;
            
            questions.forEach((container, index) => {
              const selected = container.querySelector('input[type="radio"]:checked');
              if (selected) {
                answered++;
                const selectedValue = selected.value;
                const correct = window.assessmentQuestions[index].correct;
                const isCorrect = selectedValue === correct;
                
                currentAnswers[index] = { selected: selectedValue, correct, isCorrect };
                
                if (isCorrect) {
                  score++;
                }
              }
            });
            
            if (answered < questions.length) {
              alert('Please answer all questions before submitting.');
              return;
            }
            
            const percentage = Math.round((score / questions.length) * 100);
            console.log('[SCORM Navigation] Assessment score:', percentage);
            
            // Report score to SCORM
            if (window.API) {
              try {
                console.log('[SCORM] Reporting score:', percentage);
                const rawResult = window.API.LMSSetValue('cmi.core.score.raw', percentage.toString());
                console.log('[SCORM] Set score.raw result:', rawResult);
                
                const minResult = window.API.LMSSetValue('cmi.core.score.min', '0');
                console.log('[SCORM] Set score.min result:', minResult);
                
                const maxResult = window.API.LMSSetValue('cmi.core.score.max', '100');
                console.log('[SCORM] Set score.max result:', maxResult);
                
                const commitResult = window.API.LMSCommit('');
                console.log('[SCORM] Commit result:', commitResult);
              } catch (e) {
                console.error('[SCORM] Error reporting score:', e);
              }
            }
            
            // Save assessment data
            window.assessmentData.scores.push(percentage);
            
            // Show results
            const resultsDiv = document.getElementById('assessment-results');
            if (resultsDiv) {
              resultsDiv.style.display = 'block';
              
              const scoreText = document.getElementById('score-percentage');
              if (scoreText) {
                scoreText.textContent = percentage + '%';
              }
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

  it('should report score as percentage when 1 out of 10 questions is correct', () => {
    // Select correct answer for first question only
    const q0Correct = document.querySelector('input[name="q0"][value="Option A"]') as HTMLInputElement;
    q0Correct.checked = true;
    
    // Select incorrect answers for remaining questions
    document.querySelector('input[name="q1"][value="Option D"]').checked = true;
    document.querySelector('input[name="q2"][value="Option F"]').checked = true;
    document.querySelector('input[name="q3"][value="Option H"]').checked = true;
    document.querySelector('input[name="q4"][value="Option J"]').checked = true;
    document.querySelector('input[name="q5"][value="Option L"]').checked = true;
    document.querySelector('input[name="q6"][value="Option N"]').checked = true;
    document.querySelector('input[name="q7"][value="Option P"]').checked = true;
    document.querySelector('input[name="q8"][value="Option R"]').checked = true;
    document.querySelector('input[name="q9"][value="Option T"]').checked = true;

    // Submit assessment
    window.submitAssessment();

    // Check that score reported to SCORM is 10 (percentage) not 1 (raw count)
    expect(window.scoreRawValue).toBe('10'); // 1 out of 10 = 10%
    
    // Check that score display shows percentage
    const scoreDisplay = document.getElementById('score-percentage');
    expect(scoreDisplay.textContent).toBe('10%');
  });

  it('should report score as 100 when all 10 questions are correct', () => {
    // Select all correct answers
    document.querySelector('input[name="q0"][value="Option A"]').checked = true;
    document.querySelector('input[name="q1"][value="Option C"]').checked = true;
    document.querySelector('input[name="q2"][value="Option E"]').checked = true;
    document.querySelector('input[name="q3"][value="Option G"]').checked = true;
    document.querySelector('input[name="q4"][value="Option I"]').checked = true;
    document.querySelector('input[name="q5"][value="Option K"]').checked = true;
    document.querySelector('input[name="q6"][value="Option M"]').checked = true;
    document.querySelector('input[name="q7"][value="Option O"]').checked = true;
    document.querySelector('input[name="q8"][value="Option Q"]').checked = true;
    document.querySelector('input[name="q9"][value="Option S"]').checked = true;

    // Submit assessment
    window.submitAssessment();

    // Check that score reported to SCORM is 100
    expect(window.scoreRawValue).toBe('100');
    
    // Check that score display shows percentage
    const scoreDisplay = document.getElementById('score-percentage');
    expect(scoreDisplay.textContent).toBe('100%');
  });

  it('should report 50% when 5 out of 10 questions are correct', () => {
    // Select 5 correct and 5 incorrect answers
    document.querySelector('input[name="q0"][value="Option A"]').checked = true; // correct
    document.querySelector('input[name="q1"][value="Option C"]').checked = true; // correct
    document.querySelector('input[name="q2"][value="Option E"]').checked = true; // correct
    document.querySelector('input[name="q3"][value="Option G"]').checked = true; // correct
    document.querySelector('input[name="q4"][value="Option I"]').checked = true; // correct
    document.querySelector('input[name="q5"][value="Option L"]').checked = true; // incorrect
    document.querySelector('input[name="q6"][value="Option N"]').checked = true; // incorrect
    document.querySelector('input[name="q7"][value="Option P"]').checked = true; // incorrect
    document.querySelector('input[name="q8"][value="Option R"]').checked = true; // incorrect
    document.querySelector('input[name="q9"][value="Option T"]').checked = true; // incorrect

    // Submit assessment
    window.submitAssessment();

    // Check that score reported to SCORM is 50%
    expect(window.scoreRawValue).toBe('50');
    
    // Check that score display shows percentage
    const scoreDisplay = document.getElementById('score-percentage');
    expect(scoreDisplay.textContent).toBe('50%');
  });
});