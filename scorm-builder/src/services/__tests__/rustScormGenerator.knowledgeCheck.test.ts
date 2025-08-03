import { describe, it, expect, vi } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import type { CourseContent } from '../../types/course'

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('rustScormGenerator - Knowledge check handling', () => {
  it('should convert knowledge check questions to Rust format', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        knowledgeCheck: {
          questions: [{
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1
          }]
        }
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            knowledge_check: expect.objectContaining({
              enabled: true,
              questions: expect.arrayContaining([
                expect.objectContaining({
                  type: 'multiple-choice',
                  text: 'What is 2+2?', // Should be 'text' not 'question'
                  options: ['3', '4', '5'],
                  correct_answer: '4' // Should be the actual answer, not index
                })
              ])
            })
          })
        ])
      })
    }))
  })

  it('should handle fill-in-the-blank questions', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        knowledgeCheck: {
          questions: [{
            type: 'fill-in-the-blank',
            question: 'The capital of France is ___',
            correctAnswer: 'Paris'
          }]
        }
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            knowledge_check: expect.objectContaining({
              enabled: true,
              questions: expect.arrayContaining([
                expect.objectContaining({
                  type: 'fill-in-the-blank',
                  text: 'The capital of France is ___',
                  correct_answer: 'Paris'
                })
              ])
            })
          })
        ])
      })
    }))
  })

  it('should handle topics without knowledge checks', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content'
        // No knowledgeCheck
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            knowledge_check: undefined
          })
        ])
      })
    }))
  })

  it('should handle single question format (backwards compatibility)', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'What is 2+2?',
          options: ['3', '4', '5'],
          correctAnswer: 1
        } as any // Single question format
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            knowledge_check: expect.objectContaining({
              enabled: true,
              questions: expect.arrayContaining([
                expect.objectContaining({
                  type: 'multiple-choice',
                  text: 'What is 2+2?',
                  options: ['3', '4', '5'],
                  correct_answer: '4'
                })
              ])
            })
          })
        ])
      })
    }))
  })

  it('should include explanation field when available', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Array(1000).fill(0))
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        knowledgeCheck: {
          questions: [{
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1,
            explanation: '2+2 equals 4 in basic arithmetic'
          }]
        }
      }]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            knowledge_check: expect.objectContaining({
              questions: expect.arrayContaining([
                expect.objectContaining({
                  explanation: '2+2 equals 4 in basic arithmetic'
                })
              ])
            })
          })
        ])
      })
    }))
  })
})