import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertToRustFormat } from '../rustScormGenerator'
import type { CourseContent } from '../../types/course'

// Mock fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}))

describe('RustScormGenerator - Knowledge Check Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle knowledgeChecks array in topics', async () => {
    // This is the actual data structure being used in the app
    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content 1',
          knowledgeChecks: [
            {
              id: 'kc-1',
              question: 'Question 1?',
              type: 'multiple-choice',
              options: ['A', 'B', 'C'],
              correctAnswer: 0,
              feedback: 'A is correct',
            },
          ],
        },
      ],
    }

    // Mock fs.readFile to return empty data
    const mockFs = (await import('fs')).promises as any
    mockFs.readFile.mockResolvedValue(new Uint8Array())

    // Call the internal conversion function
    const { courseData } = await convertToRustFormat(courseContent, 'test-project-id')

    // Verify the structure
    expect(courseData.topics).toHaveLength(1)
    const topic = courseData.topics[0]
    
    // The issue: knowledge_check is undefined because we're looking for
    // topic.knowledgeCheck but the data has topic.knowledgeChecks
    expect(topic.knowledge_check).toBeUndefined()
  })

  it('should correctly convert when using knowledgeCheck (singular)', async () => {
    // How the data should be structured
    const courseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content 1',
          knowledgeCheck: {
            enabled: true,
            questions: [
              {
                type: 'multiple-choice',
                question: 'Question 1?',
                options: ['A', 'B', 'C'],
                correctAnswer: 0,
                feedback: 'A is correct',
              },
            ],
          },
        },
      ],
    }

    const mockFs = (await import('fs')).promises as any
    mockFs.readFile.mockResolvedValue(new Uint8Array())

    const { courseData } = await convertToRustFormat(courseContent, 'test-project-id')

    expect(courseData.topics).toHaveLength(1)
    const topic = courseData.topics[0]
    
    // This should work
    expect(topic.knowledge_check).toBeDefined()
    expect(topic.knowledge_check.questions).toHaveLength(1)
    expect(topic.knowledge_check.questions[0].text).toBe('Question 1?')
  })

  it('should handle the actual course structure from the app', async () => {
    // This is what's actually being sent from the app
    const courseContent = {
      title: 'Natural Gas Safety',
      topics: [
        {
          id: 'safety-fundamentals',
          title: 'Core Principles of Natural Gas Safety',
          content: '<h2>Understanding Natural Gas</h2>...',
          media: [
            {
              id: 'video-1',
              type: 'video',
              url: 'https://www.youtube.com/watch?v=-njmj0diWu8',
              title: 'Natural Gas Overview',
            },
          ],
          audioId: 'audio-2',
          captionId: 'caption-2',
          knowledgeChecks: [
            {
              id: 'kc-1',
              question: 'Why is mercaptan added to natural gas?',
              type: 'multiple-choice',
              options: [
                'To make it burn hotter',
                'To aid in leak detection by giving it a distinct odor',
                'To make it lighter than air',
                'To prevent pipes from corroding',
              ],
              correctAnswer: 1,
              feedback: "Correct! Mercaptan provides the recognizable 'rotten egg' smell to help detect leaks, as natural gas is naturally odorless.",
            },
          ],
        },
      ],
    }

    const mockFs = (await import('fs')).promises as any
    mockFs.readFile.mockResolvedValue(new Uint8Array())

    const { courseData } = await convertToRustFormat(courseContent, 'test-project-id')

    // This will fail because rustScormGenerator is looking for knowledgeCheck
    // but the data has knowledgeChecks
    const topic = courseData.topics[0]
    expect(topic.knowledge_check).toBeUndefined() // This is the bug!
  })
})

// Export the function for testing
export { convertToRustFormat } from '../rustScormGenerator'