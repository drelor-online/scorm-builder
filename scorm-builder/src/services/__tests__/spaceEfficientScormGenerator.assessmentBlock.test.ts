import { describe, it, expect } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('SCORM Generator - Assessment Navigation Blocking', () => {
  it('should block navigation to assessment until all topics with knowledge checks are completed', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start'
      },
      objectives: ['Learn stuff'],
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1 with KC',
          content: 'Topic content',
          knowledgeChecks: [],
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'Test question 1?',
            options: ['A', 'B', 'C'],
            correctAnswer: 0,
            explanation: 'A is correct'
          }
        },
        {
          id: 'topic-2',
          title: 'Topic 2 without KC',
          content: 'Topic content 2',
          knowledgeChecks: []
        },
        {
          id: 'topic-3',
          title: 'Topic 3 with KC',
          content: 'Topic content 3',
          knowledgeChecks: [],
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'Test question 3?',
            options: ['X', 'Y', 'Z'],
            correctAnswer: 1,
            explanation: 'Y is correct'
          }
        }
      ],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: [{
          id: 'q1',
          question: 'Assessment question?',
          options: ['Option 1', 'Option 2'],
          correctAnswer: 0
        }]
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Check navigation.js has the assessment blocking function
    const navJs = await zip.file('scripts/navigation.js')?.async('string')
    expect(navJs).toBeTruthy()
    
    // Verify the checkAllTopicsCompleted function exists
    expect(navJs).toContain('function checkAllTopicsCompleted()')
    expect(navJs).toContain('topic.hasKnowledgeCheck')
    expect(navJs).toContain('!knowledgeCheckAttempts[topicPageId]')
    
    // Verify the assessment page check in loadPage
    expect(navJs).toContain(`if (pageId === 'assessment')`)
    expect(navJs).toContain('const incompleteTopic = checkAllTopicsCompleted()')
    expect(navJs).toContain('Please complete all topic knowledge checks before taking the assessment')
    
    // Verify course data includes hasKnowledgeCheck flags
    expect(navJs).toContain('window.courseTopics =')
    expect(navJs).toContain('"hasKnowledgeCheck":true')
    
    // Check that topic 1 and 3 are marked as having knowledge checks
    const courseTopicsMatch = navJs.match(/window\.courseTopics = (\[.*?\]);/s)
    expect(courseTopicsMatch).toBeTruthy()
    
    if (courseTopicsMatch) {
      const courseTopics = JSON.parse(courseTopicsMatch[1])
      expect(courseTopics[0].hasKnowledgeCheck).toBe(true) // Topic 1
      expect(courseTopics[0].title).toBe('Topic 1 with KC')
      expect(courseTopics[1].hasKnowledgeCheck).toBe(false) // Topic 2
      expect(courseTopics[2].hasKnowledgeCheck).toBe(true) // Topic 3
      expect(courseTopics[2].title).toBe('Topic 3 with KC')
    }
  })

  it('should show specific topic name in error message when blocking assessment', async () => {
    const mockCourseContent: EnhancedCourseContent = {
      title: 'Test Course',
      duration: 60,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        startButtonText: 'Start'
      },
      objectives: ['Learn stuff'],
      topics: [{
        id: 'topic-1',
        title: 'Electrical Safety Basics',
        content: 'Topic content',
        knowledgeChecks: [],
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'Test?',
          options: ['A', 'B'],
          correctAnswer: 0
        }
      }],
      assessment: {
        instructions: 'Test',
        passMark: 80,
        questions: []
      }
    }

    const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
    const zip = await JSZip.loadAsync(result.buffer)
    
    const navJs = await zip.file('scripts/navigation.js')?.async('string')
    expect(navJs).toBeTruthy()
    
    // Check error message includes topic title placeholder
    expect(navJs).toContain('Topic "${incompleteTopic}" still needs to be completed')
  })
})