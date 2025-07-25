import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseMetadata } from '../../types/metadata'

describe('Course Content Converter - Audio File Name Fix', () => {
  const mockMetadata: CourseMetadata = {
    title: 'Test Course',
    duration: 60,
    passMark: 80
  }

  it('should fix audio file names with incorrect prefixes', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration',
        audioFile: '0001-welcome.mp3', // Wrong prefix, should be 0000-
        captionFile: '0001-welcome.vtt', // Wrong prefix, should be 0000-
        duration: 1,
        imageKeywords: [],
        imagePrompts: [],
        media: [],
        videoSearchTerms: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration',
        audioFile: '0001-objectives.mp3', // This should stay as 0001-
        captionFile: '0001-objectives.vtt', // This should stay as 0001-
        duration: 1,
        imageKeywords: [],
        imagePrompts: [],
        media: [],
        videoSearchTerms: []
      },
      topics: [],
      assessment: {
        title: 'Assessment',
        instructions: 'Test instructions',
        narration: null,
        passMark: 80,
        questions: []
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata)

    // Welcome page should have 0000- prefix
    expect(result.welcome.audioFile).toBe('0000-welcome.mp3')
    expect(result.welcome.captionFile).toBe('0000-welcome.vtt')

    // Objectives page should keep 0001- prefix
    expect(result.objectivesPage?.audioFile).toBe('0001-objectives.mp3')
    expect(result.objectivesPage?.captionFile).toBe('0001-objectives.vtt')
  })

  it('should handle missing audio files correctly', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration',
        // No audioFile or captionFile
        duration: 1,
        imageKeywords: [],
        imagePrompts: [],
        media: [],
        videoSearchTerms: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration',
        // No audioFile or captionFile
        duration: 1,
        imageKeywords: [],
        imagePrompts: [],
        media: [],
        videoSearchTerms: []
      },
      topics: [],
      assessment: {
        title: 'Assessment',
        instructions: 'Test instructions',
        narration: null,
        passMark: 80,
        questions: []
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata)

    // Should generate default file names
    expect(result.welcome.audioFile).toBe('0000-welcome.mp3')
    expect(result.welcome.captionFile).toBe('0000-welcome.vtt')
    expect(result.objectivesPage?.audioFile).toBe('0001-objectives.mp3')
    expect(result.objectivesPage?.captionFile).toBe('0001-objectives.vtt')
  })

  it('should preserve correct prefixes', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration',
        audioFile: '0000-welcome.mp3', // Correct prefix
        captionFile: '0000-welcome.vtt', // Correct prefix
        duration: 1,
        imageKeywords: [],
        imagePrompts: [],
        media: [],
        videoSearchTerms: []
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration',
        audioFile: '0002-objectives.mp3', // Different but valid prefix
        captionFile: '0002-objectives.vtt', // Different but valid prefix
        duration: 1,
        imageKeywords: [],
        imagePrompts: [],
        media: [],
        videoSearchTerms: []
      },
      topics: [],
      assessment: {
        title: 'Assessment',
        instructions: 'Test instructions',
        narration: null,
        passMark: 80,
        questions: []
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata)

    // Should preserve existing correct prefixes
    expect(result.welcome.audioFile).toBe('0000-welcome.mp3')
    expect(result.welcome.captionFile).toBe('0000-welcome.vtt')
    expect(result.objectivesPage?.audioFile).toBe('0002-objectives.mp3')
    expect(result.objectivesPage?.captionFile).toBe('0002-objectives.vtt')
  })
})