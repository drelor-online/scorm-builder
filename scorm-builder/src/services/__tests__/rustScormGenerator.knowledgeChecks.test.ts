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

describe('RustScormGenerator - Knowledge Checks Array Issue', () => {
  let generateRustSCORM: any
  let mockInvoke: any
  
  beforeEach(async () => {
    vi.clearAllMocks()
    const core = await import('@tauri-apps/api/core')
    mockInvoke = core.invoke as any
    const mod = await import('../rustScormGenerator')
    generateRustSCORM = mod.generateRustSCORM
  })

  it('should fail when topics have knowledgeChecks array (current bug)', async () => {
    // This is how the data is currently structured in the app
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

    mockInvoke.mockResolvedValueOnce([1, 2, 3]) // Mock zip file bytes

    await generateRustSCORM(courseContent, 'test-project')

    // Check what was sent to Rust
    const rustData = mockInvoke.mock.calls[0][1].courseData
    
    // BUG: knowledge_check is undefined because converter looks for
    // knowledgeCheck (singular) not knowledgeChecks (plural)
    expect(rustData.topics[0].knowledge_check).toBeUndefined()
  })

  it('should work when topics have knowledgeCheck object (expected format)', async () => {
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

    mockInvoke.mockResolvedValueOnce([1, 2, 3])

    await generateRustSCORM(courseContent as any, 'test-project')

    const rustData = mockInvoke.mock.calls[0][1].courseData
    
    // This works correctly
    expect(rustData.topics[0].knowledge_check).toBeDefined()
    expect(rustData.topics[0].knowledge_check.questions).toHaveLength(1)
  })

  it('should demonstrate the actual data being sent from the app', async () => {
    // Real data structure from Natural Gas Safety course
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
        {
          id: 'hazard-identification',
          title: 'Recognizing and Identifying Gas Hazards',
          content: '<h2>Sensing Danger</h2>...',
          media: [{
            id: 'image-1',
            type: 'image',
            url: 'blob://image-data',
            title: 'Hazard Sign',
          }],
          audioId: 'audio-3',
          captionId: 'caption-3',
          knowledgeChecks: [{
            id: 'kc-2',
            question: 'What is the primary sign of a gas leak?',
            type: 'multiple-choice',
            options: ['Sound', 'Smell', 'Sight', 'Touch'],
            correctAnswer: 1,
            feedback: 'The distinct odor of mercaptan is the most common sign.',
          }],
        },
      ],
    }

    mockInvoke.mockResolvedValueOnce([1, 2, 3])

    await generateRustSCORM(courseContent as any, 'test-project')

    const rustData = mockInvoke.mock.calls[0][1].courseData
    
    // All topics should have knowledge checks, but they don't!
    expect(rustData.topics[0].knowledge_check).toBeUndefined() // BUG
    expect(rustData.topics[1].knowledge_check).toBeUndefined() // BUG
    
    // This is why knowledge checks aren't showing in the SCORM output
  })
})