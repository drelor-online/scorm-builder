import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseMetadata } from '../../types/metadata'

describe('courseContentConverter - file extensions', () => {
  it('should use .bin extension for audio files to match storage format', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [],
        narration: 'Welcome narration text',
        duration: 30,
        startButtonText: 'Start Course'
      },
      learningObjectivesPage: {
        content: '<ul><li>Objective 1</li></ul>',
        media: [],
        narration: 'Objectives narration',
        duration: 30
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic content',
          narration: 'Topic narration',
          media: [],
          duration: 60,
          imagePrompts: [],
          imageKeywords: [],
          knowledgeCheck: {
            questions: [{
              id: 'kc-1',
              type: 'multiple-choice',
              question: 'Test question?',
              options: ['A', 'B', 'C'],
              correctAnswer: 'A',
              feedback: {
                correct: 'Correct!',
                incorrect: 'Try again'
              }
            }]
          }
        }
      ],
      assessment: {
        questions: [],
        passMark: 80
      }
    }
    
    const metadata: CourseMetadata = {
      title: 'Test Course',
      duration: 120,
      passMark: 80
    }
    
    const result = convertToEnhancedCourseContent(courseContent, metadata)
    
    // Audio files should use .bin extension to match how they're stored
    expect(result.welcome.audioFile).toBe('audio-0.bin')
    expect(result.objectivesPage?.audioFile).toBe('audio-1.bin')
    expect(result.topics[0].audioFile).toBe('audio-2.bin')
    
    // Caption files should also use .bin extension
    expect(result.welcome.captionFile).toBe('caption-0.bin')
    expect(result.objectivesPage?.captionFile).toBe('caption-1.bin')
    expect(result.topics[0].captionFile).toBe('caption-2.bin')
  })
  
  it('should preserve existing .bin extensions if already present', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [],
        narration: 'Welcome narration',
        audioFile: 'audio-0.bin', // Already has .bin extension
        captionFile: 'caption-0.bin',
        duration: 30,
        startButtonText: 'Start Course'
      },
      learningObjectivesPage: {
        content: '<ul><li>Objective 1</li></ul>',
        media: [],
        duration: 30
      },
      topics: [],
      assessment: {
        questions: [],
        passMark: 80
      }
    }
    
    const metadata: CourseMetadata = {
      title: 'Test Course',
      duration: 120,
      passMark: 80
    }
    
    const result = convertToEnhancedCourseContent(courseContent, metadata)
    
    // Should preserve existing .bin extensions
    expect(result.welcome.audioFile).toBe('audio-0.bin')
    expect(result.welcome.captionFile).toBe('caption-0.bin')
  })
})