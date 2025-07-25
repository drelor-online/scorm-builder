import { describe, it, expect, beforeEach } from 'vitest'
import { generateEnhancedTopicPage } from '../spaceEfficientScormGeneratorEnhanced'
import { generateEnhancedNavigationJs } from '../spaceEfficientScormGeneratorNavigation'
import type { EnhancedTopic, EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Knowledge Check Navigation Gating', () => {
  let mockTopic: EnhancedTopic
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockTopic = {
      id: 'topic-1',
      title: 'Test Topic',
      content: 'This is the topic content.',
      duration: 5,
      media: [],
      knowledgeCheck: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is the correct answer?',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 'Option B',
            feedback: {
              correct: 'Correct! Option B is the right answer.',
              incorrect: 'Not quite. The correct answer is Option B.'
            }
          }
        ]
      }
    }
    
    // Create a minimal mock course content
    mockCourseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        startButtonText: 'Start',
        media: []
      },
      objectives: ['Objective 1'],
      topics: [mockTopic],
      assessment: {
        questions: []
      }
    }
  })

  describe('Knowledge Check Display', () => {
    it('should include knowledge check section when questions exist', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      expect(html).toContain('class="knowledge-check"')
      expect(html).toContain('<h2>Knowledge Check</h2>')
      expect(html).toContain('What is the correct answer?')
      expect(html).toContain('Option A')
      expect(html).toContain('Option B')
      expect(html).toContain('Option C')
      expect(html).toContain('Option D')
    })

    it('should have disabled Next button initially when knowledge check exists', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      // Next button should be disabled by default
      expect(html).toContain('id="nextBtn"')
      expect(html).toContain('data-requires-answer="true"')
      expect(html).toContain('class="nav-button nav-next disabled"')
    })

    it('should not disable Next button when no knowledge check exists', () => {
      delete mockTopic.knowledgeCheck
      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      expect(html).not.toContain('data-requires-answer="true"')
      expect(html).not.toContain('class="nav-button nav-next disabled"')
    })
  })

  describe('Knowledge Check Answer Handling', () => {
    it('should include JavaScript to handle answer submission', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      // Should have answer submission handler
      expect(html).toContain('function submitAnswer()')
      expect(html).toContain('document.querySelector(\'input[name="q1"]:checked\')')
      expect(html).toContain('enableNextButton()')
    })

    it('should show feedback after answering', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      expect(html).toContain('id="feedback-q1"')
      expect(html).toContain('class="feedback"')
      expect(html).toContain('style="display: none;"')
    })

    it('should enable Next button after answering', () => {
      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      expect(html).toContain('function enableNextButton()')
      expect(html).toContain('nextBtn.disabled = false')
      expect(html).toContain('nextBtn.classList.remove("disabled")')
    })
  })

  describe('Navigation JavaScript', () => {
    it('should prevent navigation when knowledge check not answered', () => {
      const js = generateEnhancedNavigationJs()
      
      // Should check if answer is required
      expect(js).toContain('function canNavigateNext()')
      expect(js).toContain('const nextBtn = document.getElementById("nextBtn")')
      expect(js).toContain('nextBtn.dataset.requiresAnswer === "true"')
      expect(js).toContain('nextBtn.disabled')
    })

    it('should track answered questions', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('let answeredQuestions = {}')
      expect(js).toContain('answeredQuestions[currentPage] = true')
    })

    it('should allow backward navigation always', () => {
      const js = generateEnhancedNavigationJs()
      
      expect(js).toContain('function previousPage()')
      expect(js).not.toContain('canNavigatePrevious()')
    })
  })

  describe('Multiple Questions', () => {
    it('should require all questions to be answered before proceeding', () => {
      mockTopic.knowledgeCheck!.questions.push({
        id: 'q2',
        type: 'multiple-choice',
        question: 'What is the second answer?',
        options: ['X', 'Y', 'Z'],
        correctAnswer: 'Y',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Try again.'
        }
      })

      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      expect(html).toContain('data-question-count="2"')
      expect(html).toContain('function checkAllQuestionsAnswered()')
      expect(html).toContain('document.querySelectorAll(".question-answered").length')
    })
  })

  describe('Question Types', () => {
    it('should support true/false questions', () => {
      mockTopic.knowledgeCheck!.questions[0] = {
        id: 'q1',
        type: 'true-false',
        question: 'Is this statement true?',
        options: ['True', 'False'],
        correctAnswer: 'True',
        feedback: {
          correct: 'Correct!',
          incorrect: 'Incorrect.'
        }
      }

      const html = generateEnhancedTopicPage(mockTopic, 3, mockCourseContent)
      
      expect(html).toContain('type="radio"')
      expect(html).toContain('value="True"')
      expect(html).toContain('value="False"')
    })
  })
})