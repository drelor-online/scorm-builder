import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent, CourseMetadata } from '../../types/scorm'

describe('courseContentConverter - Default ID Generation Bug', () => {
  it('should NOT generate default audio/caption IDs for topics with narration but no audio files', () => {
    const courseContent: CourseContent = {
      courseTitle: 'Test Course',
      topics: [
        {
          id: 'topic-0',
          title: 'Topic with audio',
          content: 'Content 1',
          narration: 'This topic has both narration and audio',
          media: [
            { id: 'audio-2', type: 'audio', url: '', title: 'Audio' },
            { id: 'caption-2', type: 'caption' as any, url: '', title: 'Caption' }
          ],
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        {
          id: 'topic-1', 
          title: 'Topic with narration only',
          content: 'Content 2',
          narration: 'This topic has narration text but NO audio file',
          media: [], // No audio or caption media
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        },
        {
          id: 'topic-10',
          title: 'Last topic with narration only',
          content: 'Content 11',
          narration: 'This is topic-10 (11th topic) with narration but no audio',
          media: [], // No audio or caption media
          knowledgeCheck: {
            questions: [{
              type: 'multiple-choice',
              question: 'Test question',
              options: ['A', 'B', 'C'],
              correctAnswer: 0
            }]
          },
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 1
        }
      ],
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        narration: 'Welcome narration without audio',
        media: [],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives content',
        narration: 'Objectives narration without audio',
        objectives: ['Objective 1', 'Objective 2'],
        media: [],
        audioFile: undefined,
        captionFile: undefined,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const metadata: CourseMetadata = {
      title: 'Test Course',
      description: 'Test',
      topics: []
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)

    // Check welcome page - should NOT have audioFile/captionFile
    expect(enhanced.welcome.audioFile).toBeUndefined()
    expect(enhanced.welcome.captionFile).toBeUndefined()
    expect(enhanced.welcome.narration).toBe('Welcome narration without audio')

    // Check objectives page - should NOT have audioFile/captionFile
    expect(enhanced.objectivesPage?.audioFile).toBeUndefined()
    expect(enhanced.objectivesPage?.captionFile).toBeUndefined()
    expect(enhanced.objectivesPage?.narration).toBe('Objectives narration without audio')

    // Check topic-0 which HAS audio - should have the actual IDs
    expect(enhanced.topics[0].audioFile).toBe('audio-2')
    expect(enhanced.topics[0].captionFile).toBe('caption-2')
    expect(enhanced.topics[0].narration).toBe('This topic has both narration and audio')

    // Check topic-1 which has narration but NO audio - should NOT have generated IDs
    expect(enhanced.topics[1].audioFile).toBeUndefined()
    expect(enhanced.topics[1].captionFile).toBeUndefined()
    expect(enhanced.topics[1].narration).toBe('This topic has narration text but NO audio file')

    // Check topic-10 (11th topic) - should NOT have generated audio-12/caption-12
    expect(enhanced.topics[2].audioFile).toBeUndefined()
    expect(enhanced.topics[2].captionFile).toBeUndefined()
    expect(enhanced.topics[2].narration).toBe('This is topic-10 (11th topic) with narration but no audio')
    
    // The bug would have generated these:
    expect(enhanced.topics[2].audioFile).not.toBe('audio-12')
    expect(enhanced.topics[2].captionFile).not.toBe('caption-12')
  })

  it('should only use actual media IDs that exist, never generate defaults', () => {
    const courseContent: CourseContent = {
      courseTitle: 'Test Course',
      topics: Array.from({ length: 11 }, (_, i) => ({
        id: `topic-${i}`,
        title: `Topic ${i + 1}`,
        content: `Content for topic ${i + 1}`,
        narration: `Narration for topic ${i + 1}`, // All have narration
        media: i < 10 ? [ // Only first 10 have audio
          { id: `audio-${i + 2}`, type: 'audio', url: '', title: 'Audio' },
          { id: `caption-${i + 2}`, type: 'caption' as any, url: '', title: 'Caption' }
        ] : [], // topic-10 has no media
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      })),
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome',
        narration: 'Welcome narration',
        media: [
          { id: 'audio-0', type: 'audio', url: '', title: 'Audio' }
        ],
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives',
        narration: 'Objectives narration',
        objectives: ['Learn'],
        media: [
          { id: 'audio-1', type: 'audio', url: '', title: 'Audio' }
        ],
        audioFile: undefined,
        captionFile: undefined,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const metadata: CourseMetadata = {
      title: 'Test Course',
      description: 'Test',
      topics: []
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)

    // First 10 topics should have their actual media IDs
    for (let i = 0; i < 10; i++) {
      expect(enhanced.topics[i].audioFile).toBe(`audio-${i + 2}`)
      expect(enhanced.topics[i].captionFile).toBe(`caption-${i + 2}`)
    }

    // Topic-10 (11th topic) should NOT have generated IDs despite having narration
    expect(enhanced.topics[10].audioFile).toBeUndefined()
    expect(enhanced.topics[10].captionFile).toBeUndefined()
    expect(enhanced.topics[10].narration).toBe('Narration for topic 11')
  })
})