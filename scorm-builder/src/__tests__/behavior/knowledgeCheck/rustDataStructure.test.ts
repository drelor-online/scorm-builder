import { describe, it, expect, vi } from 'vitest'
import { generateRustSCORM } from '../../../services/rustScormGenerator'
import type { CourseContent } from '../../../types/course'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Rust SCORM Generator - Knowledge Check Data Structure', () => {
  it('should pass knowledge check data correctly to Rust', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Uint8Array())
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic with Knowledge Check',
          content: '<p>Test content</p>',
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'What is the correct answer?',
            options: ['Option A', 'Option B', 'Option C'],
            correctAnswer: 1,
            explanation: 'Option B is correct'
          }
        }
      ]
    }

    await generateRustSCORM(courseContent, 'test-project')

    // Verify the structure passed to Rust
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            id: 'topic-1',
            title: 'Topic with Knowledge Check',
            content: '<p>Test content</p>',
            knowledge_check: expect.objectContaining({
              enabled: true,
              questions: expect.arrayContaining([
                expect.objectContaining({
                  type: 'multiple-choice',
                  text: 'What is the correct answer?',
                  options: ['Option A', 'Option B', 'Option C'],
                  correct_answer: 'Option B', // Should be converted to actual answer
                  explanation: 'Option B is correct'
                })
              ])
            })
          })
        ])
      })
    }))
  })

  it('should handle topics without knowledge checks', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Uint8Array())
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-2',
          title: 'Topic without Knowledge Check',
          content: '<p>No KC here</p>'
        }
      ]
    }

    await generateRustSCORM(courseContent, 'test-project')

    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', expect.objectContaining({
      courseData: expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({
            id: 'topic-2',
            knowledge_check: undefined
          })
        ])
      })
    }))
  })

  it('should preserve question_type field name for Rust', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(new Uint8Array())
    vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

    const courseContent: CourseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-3',
          title: 'Fill in the Blank',
          content: '<p>Test</p>',
          knowledgeCheck: {
            type: 'fill-in-the-blank',
            question: 'The capital is ___',
            correctAnswer: 'Paris'
          } as any
        }
      ]
    }

    await generateRustSCORM(courseContent, 'test-project')

    const call = mockInvoke.mock.calls[0]
    const rustData = call[1].courseData.topics[0].knowledge_check.questions[0]
    
    // Rust expects 'type' not 'question_type'
    expect(rustData).toHaveProperty('type', 'fill-in-the-blank')
    expect(rustData).not.toHaveProperty('question_type')
  })
})