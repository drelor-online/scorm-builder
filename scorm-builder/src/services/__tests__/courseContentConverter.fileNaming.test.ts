import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent, CourseMetadata } from '../../types/course'

describe('courseContentConverter - file naming convention', () => {
  const mockMetadata: CourseMetadata = {
    id: 'test-course',
    title: 'Test Course',
    description: 'Test description',
    duration: 30,
    passMark: 80,
    version: '1.0.0'
  }

  const mockStorage = {
    getMediaUrl: async (id: string) => `https://storage.com/${id}`,
    hasMedia: async (id: string) => true
  }

  it('should NOT use topic names in audio file names', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        duration: 5
      },
      learningObjectivesPage: {
        title: 'Objectives',
        content: 'Objectives content',
        objectives: ['Objective 1'],
        duration: 5
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction to Variables and Data Types',
          content: 'Topic content',
          duration: 10,
          imagePrompts: [],
          imageKeywords: [],
          narration: 'Topic narration',
          media: []
        },
        {
          id: 'topic-2',
          title: 'Advanced Functions & Methods',
          content: 'Topic 2 content',
          duration: 10,
          imagePrompts: [],
          imageKeywords: [],
          narration: 'Topic 2 narration',
          media: []
        }
      ],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata, mockStorage)

    // Audio files should use simple format: audio-{number}.mp3
    // Welcome is audio-0, objectives is audio-1, so topics start at audio-2
    expect(result.topics[0].audioFile).toBe('audio-2.mp3')
    expect(result.topics[1].audioFile).toBe('audio-3.mp3')
    
    // Should NOT contain topic names
    expect(result.topics[0].audioFile).not.toContain('variables')
    expect(result.topics[0].audioFile).not.toContain('data-types')
    expect(result.topics[1].audioFile).not.toContain('functions')
    expect(result.topics[1].audioFile).not.toContain('methods')
  })

  it('should NOT use topic names in caption file names', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        duration: 5
      },
      learningObjectivesPage: {
        title: 'Objectives',
        content: 'Objectives content',
        objectives: ['Objective 1'],
        duration: 5
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Working with Complex Algorithms',
          content: 'Topic content',
          duration: 10,
          imagePrompts: [],
          imageKeywords: [],
          narration: 'Topic narration',
          media: []
        }
      ],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata, mockStorage)

    // Caption files should use simple format: caption-{number}.vtt
    expect(result.topics[0].captionFile).toBe('caption-2.vtt')
    
    // Should NOT contain topic names
    expect(result.topics[0].captionFile).not.toContain('complex')
    expect(result.topics[0].captionFile).not.toContain('algorithms')
  })

  it('should NOT use topic names in image file names', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        duration: 5
      },
      learningObjectivesPage: {
        title: 'Objectives',
        content: 'Objectives content',
        objectives: ['Objective 1'],
        duration: 5
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Database Management Systems',
          content: 'Topic content',
          duration: 10,
          imagePrompts: ['database diagram'],
          imageKeywords: ['database', 'sql'],
          narration: '',
          media: []
        }
      ],
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata, mockStorage)

    // Image files should use simple format: image-{number}.jpg
    expect(result.topics[0].imageUrl).toBe('image-0.jpg')
    
    // Should NOT contain topic names
    expect(result.topics[0].imageUrl).not.toContain('database')
    expect(result.topics[0].imageUrl).not.toContain('management')
    expect(result.topics[0].imageUrl).not.toContain('systems')
  })

  it('should maintain correct numbering for multiple topics', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        title: 'Welcome',
        content: 'Welcome content',
        duration: 5,
        narration: 'Welcome narration'
      },
      learningObjectivesPage: {
        title: 'Objectives',
        content: 'Objectives content',
        objectives: ['Objective 1'],
        duration: 5,
        narration: 'Objectives narration'
      },
      topics: Array.from({ length: 5 }, (_, i) => ({
        id: `topic-${i + 1}`,
        title: `Topic ${i + 1} with Complex Title & Special Characters!`,
        content: `Topic ${i + 1} content`,
        duration: 10,
        imagePrompts: ['test'],
        imageKeywords: ['test'],
        narration: `Topic ${i + 1} narration`,
        media: []
      })),
      assessment: {
        questions: [],
        passMark: 80
      }
    }

    const result = convertToEnhancedCourseContent(courseContent, mockMetadata, mockStorage)

    // Check welcome and objectives pages
    expect(result.welcome.audioFile).toBe('audio-0.mp3')
    expect(result.objectivesPage.audioFile).toBe('audio-1.mp3')

    // Check all topics use sequential numbering starting from 2
    for (let i = 0; i < 5; i++) {
      expect(result.topics[i].audioFile).toBe(`audio-${i + 2}.mp3`)
      expect(result.topics[i].captionFile).toBe(`caption-${i + 2}.vtt`)
      expect(result.topics[i].imageUrl).toBe(`image-${i}.jpg`) // Images numbered separately
      
      // Ensure no topic names in any file
      expect(result.topics[i].audioFile).not.toContain('topic')
      expect(result.topics[i].captionFile).not.toContain('topic')
      expect(result.topics[i].imageUrl).not.toContain('topic')
    }
  })
})