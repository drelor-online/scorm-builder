import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CourseContent } from '../../types/course'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  },
}))

describe('RustScormGenerator - Knowledge Checks Fix', () => {
  let generateRustSCORM: any
  let mockInvoke: any
  
  beforeEach(async () => {
    vi.clearAllMocks()
    const core = await import('@tauri-apps/api/core')
    mockInvoke = core.invoke as any
    const mod = await import('../rustScormGenerator')
    generateRustSCORM = mod.generateRustSCORM
  })

  it('should now handle knowledgeChecks array properly', async () => {
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

    mockInvoke.mockResolvedValueOnce([1, 2, 3])

    await generateRustSCORM(courseContent, 'test-project')

    const rustData = mockInvoke.mock.calls[0][1].courseData
    
    // Now it should work!
    expect(rustData.topics[0].knowledge_check).toBeDefined()
    expect(rustData.topics[0].knowledge_check.questions).toHaveLength(1)
    expect(rustData.topics[0].knowledge_check.questions[0]).toMatchObject({
      type: 'multiple-choice',
      text: 'Question 1?',
      options: ['A', 'B', 'C'],
      correct_answer: 'A',
      explanation: '',
    })
  })

  it('should handle multiple knowledge checks in the array', async () => {
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
            {
              id: 'kc-2',
              question: 'Question 2?',
              type: 'fill-in-blank',
              correctAnswer: 'answer',
              feedback: 'Good job!',
            },
          ],
        },
      ],
    }

    mockInvoke.mockResolvedValueOnce([1, 2, 3])

    await generateRustSCORM(courseContent, 'test-project')

    const rustData = mockInvoke.mock.calls[0][1].courseData
    
    expect(rustData.topics[0].knowledge_check).toBeDefined()
    expect(rustData.topics[0].knowledge_check.questions).toHaveLength(2)
    expect(rustData.topics[0].knowledge_check.questions[0].type).toBe('multiple-choice')
    expect(rustData.topics[0].knowledge_check.questions[1].type).toBe('fill-in-blank')
  })

  it('should also handle audioId and captionId fields', async () => {
    const courseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content 1',
          audioId: 'audio-1',
          captionId: 'caption-1',
          knowledgeChecks: [{
            id: 'kc-1',
            question: 'Test?',
            type: 'multiple-choice',
            options: ['A', 'B'],
            correctAnswer: 0,
            feedback: 'Good',
          }],
        },
      ],
    }

    mockInvoke.mockResolvedValueOnce([1, 2, 3])

    await generateRustSCORM(courseContent as any, 'test-project')

    const rustData = mockInvoke.mock.calls[0][1].courseData
    
    // Should map audioId -> audio_file and captionId -> caption_file
    expect(rustData.topics[0].audio_file).toBe('audio-1')
    expect(rustData.topics[0].caption_file).toBe('caption-1')
  })

  it('should handle real course data structure correctly', async () => {
    const courseContent = {
      title: 'Natural Gas Safety',
      topics: [
        {
          id: 'safety-fundamentals',
          title: 'Core Principles of Natural Gas Safety',
          content: '<h2>Understanding Natural Gas</h2>...',
          media: [{
            id: 'video-1',
            type: 'video',
            url: 'https://www.youtube.com/watch?v=-njmj0diWu8',
            title: 'Natural Gas Overview',
          }],
          audioId: 'audio-2',
          captionId: 'caption-2',
          knowledgeChecks: [{
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
            feedback: "Correct! Mercaptan provides the 'rotten egg' smell.",
          }],
        },
      ],
    }

    mockInvoke.mockResolvedValueOnce([1, 2, 3])

    await generateRustSCORM(courseContent as any, 'test-project')

    const rustData = mockInvoke.mock.calls[0][1].courseData
    const topic = rustData.topics[0]
    
    // All data should be properly converted
    expect(topic.knowledge_check).toBeDefined()
    expect(topic.knowledge_check.questions).toHaveLength(1)
    expect(topic.knowledge_check.questions[0].correct_answer).toBe('To aid in leak detection by giving it a distinct odor')
    expect(topic.audio_file).toBe('audio-2')
    expect(topic.caption_file).toBe('caption-2')
  })
})