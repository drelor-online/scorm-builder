import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent } from '../../types/aiPrompt'

describe('courseContentConverter - audioId/captionId preservation', () => {
  it('should preserve audioId and captionId fields from course content', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        duration: 30,
        imagePrompts: [],
        imageKeywords: [],
        videoSearchTerms: [],
        narration: 'Welcome narration',
        audioId: 'audio-0', // This should be preserved
        captionId: 'caption-0' // This should be preserved
      } as any,
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives content',
        duration: 60,
        imagePrompts: [],
        imageKeywords: [],
        videoSearchTerms: [],
        narration: 'Objectives narration',
        audioId: 'audio-1', // This should be preserved
        captionId: 'caption-1' // This should be preserved
      } as any,
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic 1 content',
          duration: 120,
          imagePrompts: [],
          imageKeywords: [],
          videoSearchTerms: [],
          narration: 'Topic 1 narration',
          audioId: 'audio-2', // This should be preserved
          captionId: 'caption-2', // This should be preserved
          knowledgeCheck: {
            questions: [{
              id: 'q1',
              type: 'multiple-choice',
              question: 'Test question?',
              options: ['A', 'B', 'C'],
              correctAnswer: 'A'
            }]
          }
        } as any
      ],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const metadata = {
      title: 'Test Course',
      description: 'Test Description'
    }

    const result = convertToEnhancedCourseContent(courseContent, metadata, 'test-project')

    // Check welcome page
    expect(result.welcome.audioId).toBe('audio-0')
    expect(result.welcome.captionId).toBe('caption-0')

    // Check objectives page
    expect(result.objectivesPage.audioId).toBe('audio-1')
    expect(result.objectivesPage.captionId).toBe('caption-1')

    // Check topics
    expect(result.topics[0].audioId).toBe('audio-2')
    expect(result.topics[0].captionId).toBe('caption-2')
  })

  it('should use audioId/captionId over audioFile/captionFile when both are present', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        duration: 30,
        imagePrompts: [],
        imageKeywords: [],
        videoSearchTerms: [],
        narration: 'Welcome narration',
        audioFile: 'old-audio.bin', // Old format
        audioId: 'audio-0', // New format - should take precedence
        captionFile: 'old-caption.bin', // Old format
        captionId: 'caption-0' // New format - should take precedence
      } as any,
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives content',
        duration: 60,
        imagePrompts: [],
        imageKeywords: [],
        videoSearchTerms: [],
        narration: '',
        audioId: 'audio-1'
      } as any,
      topics: [],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const metadata = {
      title: 'Test Course',
      description: 'Test Description'
    }

    const result = convertToEnhancedCourseContent(courseContent, metadata, 'test-project')

    // Should prefer audioId/captionId over audioFile/captionFile
    expect(result.welcome.audioFile).toBe('audio-0')
    expect(result.welcome.captionFile).toBe('caption-0')
  })

  it('should fall back to generated filenames when no audioId is present', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        duration: 30,
        imagePrompts: [],
        imageKeywords: [],
        videoSearchTerms: [],
        narration: 'Welcome narration'
        // No audioId or audioFile
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives content',
        duration: 60,
        imagePrompts: [],
        imageKeywords: [],
        videoSearchTerms: [],
        narration: 'Objectives narration'
        // No audioId or audioFile
      },
      topics: [],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const metadata = {
      title: 'Test Course',
      description: 'Test Description'
    }

    const result = convertToEnhancedCourseContent(courseContent, metadata, 'test-project')

    // Should generate filenames when audioId is not present
    expect(result.welcome.audioFile).toBe('audio-0.bin')
    expect(result.welcome.captionFile).toBe('caption-0.bin')
    expect(result.objectivesPage.audioFile).toBe('audio-1.bin')
    expect(result.objectivesPage.captionFile).toBe('caption-1.bin')
  })
})