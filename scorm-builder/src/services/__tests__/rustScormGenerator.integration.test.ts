import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import type { EnhancedCourseContent } from '../spaceEfficientScormGenerator'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Rust SCORM Generator - Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should generate SCORM package with all fixes applied', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockInvoke = invoke as any
    
    // Mock successful SCORM generation
    mockInvoke.mockResolvedValue(new Array(1000).fill(0))
    
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course with All Features',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome to the Course',
        content: '<p>Welcome content</p>',
        startButtonText: 'Start Course',
        audioFile: 'audio-0.bin', // Using .bin extension
        captionFile: 'caption-0.bin',
        media: [{
          id: 'welcome-img',
          url: 'image-welcome.jpg',
          title: 'Welcome Image',
          type: 'image'
        }]
      },
      objectives: ['Learn about testing', 'Understand SCORM'],
      objectivesPage: {
        audioFile: 'audio-1.bin',
        captionFile: 'caption-1.bin',
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction to Testing',
          content: '<p>Testing is important</p>',
          audioFile: 'audio-2.bin',
          captionFile: 'caption-2.bin',
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'What is testing?',
            options: ['Quality assurance', 'Random activity', 'Not important'],
            correctAnswer: 0,
            explanation: 'Testing ensures quality',
            questions: [{
              id: 'kc1',
              type: 'multiple-choice',
              question: 'What is testing?',
              options: ['Quality assurance', 'Random activity', 'Not important'],
              correctAnswer: 0,
              explanation: 'Testing ensures quality'
            }]
          },
          media: [{
            id: 'topic1-video',
            url: 'video-1.mp4',
            title: 'Testing Video',
            type: 'video',
            embedUrl: 'https://example.com/embed/1'
          }]
        },
        {
          id: 'topic-2',
          title: 'Types of Testing',
          content: '<p>There are many types of testing</p>',
          audioFile: 'audio-3.bin',
          captionFile: 'caption-3.bin',
          knowledgeCheck: {
            questions: [{
              id: 'kc2',
              type: 'fill-in-the-blank',
              blank: 'Unit testing tests individual _____.',
              question: 'Unit testing tests individual _____.',
              correctAnswer: 'components',
              explanation: 'Unit tests focus on components'
            }]
          },
          media: []
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            question: 'What is SCORM?',
            options: ['A standard', 'A game', 'A movie'],
            correctAnswer: 0
          },
          {
            id: 'q2',
            question: 'SCORM stands for?',
            options: [
              'Sharable Content Object Reference Model',
              'Simple Course Object Reference Model',
              'Standard Course Object Reference Model'
            ],
            correctAnswer: 0
          }
        ]
      }
    }
    
    const projectId = 'test-project-123'
    
    // Generate SCORM package
    const result = await generateRustSCORM(courseContent, projectId)
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
      courseData: expect.objectContaining({
        course_title: 'Test Course with All Features',
        pass_mark: 80,
        navigation_mode: 'linear',
        allow_retake: true,
        welcome_page: expect.objectContaining({
          title: 'Welcome to the Course',
          content: '<p>Welcome content</p>',
          start_button_text: 'Start Course',
          audio_file: 'audio-0.bin',
          caption_file: 'caption-0.bin',
          media: expect.arrayContaining([
            expect.objectContaining({
              id: 'welcome-img',
              type: 'image',
              url: 'image-welcome.jpg',
              title: 'Welcome Image'
            })
          ])
        }),
        learning_objectives_page: expect.objectContaining({
          objectives: ['Learn about testing', 'Understand SCORM'],
          audio_file: 'audio-1.bin',
          caption_file: 'caption-1.bin'
        }),
        topics: expect.arrayContaining([
          expect.objectContaining({
            id: 'topic-1',
            title: 'Introduction to Testing',
            content: '<p>Testing is important</p>',
            audio_file: 'audio-2.bin',
            caption_file: 'caption-2.bin',
            knowledge_check: expect.objectContaining({
              enabled: true,
              questions: expect.arrayContaining([
                expect.objectContaining({
                  type: 'multiple-choice',
                  text: 'What is testing?',
                  options: ['Quality assurance', 'Random activity', 'Not important'],
                  correct_answer: 'Quality assurance', // String value from options
                  explanation: 'Testing ensures quality'
                })
              ])
            })
          }),
          expect.objectContaining({
            id: 'topic-2',
            title: 'Types of Testing',
            content: '<p>There are many types of testing</p>',
            audio_file: 'audio-3.bin',
            caption_file: 'caption-3.bin',
            knowledge_check: expect.objectContaining({
              enabled: true,
              questions: expect.arrayContaining([
                expect.objectContaining({
                  type: 'fill-in-the-blank',
                  text: 'Unit testing tests individual _____.',
                  correct_answer: 'components',
                  explanation: 'Unit tests focus on components'
                })
              ])
            })
          })
        ]),
        assessment: expect.objectContaining({
          questions: expect.arrayContaining([
            expect.objectContaining({
              type: 'multiple-choice',
              text: 'What is SCORM?',
              options: ['A standard', 'A game', 'A movie'],
              correct_answer: expect.any(String)
            })
          ])
        })
      }),
      projectId: projectId
    })
    
    // Verify result
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(1000)
  })
  
  it('should handle knowledge check questions in both array and single formats', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockInvoke = invoke as any
    
    mockInvoke.mockResolvedValue(new Array(100).fill(0))
    
    const courseContent = {
      title: 'Test',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content',
          knowledgeCheck: {
            // Single question format (from convertKnowledgeCheck)
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C'],
            correctAnswer: 'A', // Use string value
            explanation: 'A is correct'
          }
        },
        {
          id: 'topic-2', 
          title: 'Topic 2',
          content: 'Content 2',
          knowledgeCheck: {
            // Array format
            questions: [{
              id: 'q1',
              type: 'true-false',
              question: 'True or false?',
              correctAnswer: 'True',
              explanation: 'It is true'
            }]
          }
        }
      ]
    } as any
    
    await generateRustSCORM(courseContent, 'test-id')
    
    const callArgs = mockInvoke.mock.calls[0][1]
    
    // Topic 1 should have the single question converted to array
    expect(callArgs.courseData.topics[0].knowledge_check.questions).toHaveLength(1)
    expect(callArgs.courseData.topics[0].knowledge_check.questions[0]).toMatchObject({
      type: 'multiple-choice',
      text: 'Test question?',
      options: ['A', 'B', 'C'],
      correct_answer: 'A' // Should be string value from options
    })
    
    // Topic 2 should have the array format preserved
    expect(callArgs.courseData.topics[1].knowledge_check.questions).toHaveLength(1)
    expect(callArgs.courseData.topics[1].knowledge_check.questions[0]).toMatchObject({
      type: 'true-false',
      text: 'True or false?',
      correct_answer: 'True'
    })
  })
})