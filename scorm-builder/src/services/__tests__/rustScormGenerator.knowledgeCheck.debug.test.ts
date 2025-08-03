import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

describe('rustScormGenerator - knowledge check debugging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include knowledge check data for all topics', async () => {
    const projectId = 'test-project'
    
    // Track what data is sent to Rust
    let capturedRustData: any = null
    
    // Mock Tauri invoke to capture the data
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'generate_scorm_enhanced') {
        capturedRustData = args.courseData
        
        // Log the data for debugging
        console.log('Topics with knowledge checks:')
        args.courseData.topics.forEach((topic: any, index: number) => {
          console.log(`Topic ${index}: ${topic.title}`)
          console.log(`  Has KC: ${!!topic.knowledge_check}`)
          if (topic.knowledge_check) {
            console.log(`  KC enabled: ${topic.knowledge_check.enabled}`)
            console.log(`  KC questions: ${topic.knowledge_check.questions?.length || 0}`)
          }
        })
        
        return new Uint8Array([1, 2, 3]) // Mock ZIP data
      }
      throw new Error(`Unknown command: ${cmd}`)
    })

    const courseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic 1 content',
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correctAnswer: 1
          }
        },
        {
          id: 'topic-2', 
          title: 'Topic 2',
          content: 'Topic 2 content',
          knowledgeCheck: {
            type: 'true-false',
            question: 'The sky is blue',
            correctAnswer: 'true'
          }
        },
        {
          id: 'topic-3',
          title: 'Topic 3', 
          content: 'Topic 3 content',
          knowledgeCheck: {
            type: 'fill-in-the-blank',
            question: 'The capital of France is _____',
            blank: 'The capital of France is _____',
            correctAnswer: 'Paris'
          }
        }
      ]
    }

    await generateRustSCORM(courseContent, projectId)
    
    // Verify all topics have knowledge checks
    expect(capturedRustData).toBeDefined()
    expect(capturedRustData.topics).toHaveLength(3)
    
    // Check Topic 1 - multiple choice
    const topic1 = capturedRustData.topics[0]
    expect(topic1.knowledge_check).toBeDefined()
    expect(topic1.knowledge_check.enabled).toBe(true)
    expect(topic1.knowledge_check.questions).toHaveLength(1)
    expect(topic1.knowledge_check.questions[0]).toMatchObject({
      type: 'multiple-choice',
      text: 'What is 2+2?',
      options: ['3', '4', '5'],
      correct_answer: '4'
    })
    
    // Check Topic 2 - true/false
    const topic2 = capturedRustData.topics[1]
    expect(topic2.knowledge_check).toBeDefined()
    expect(topic2.knowledge_check.enabled).toBe(true)
    expect(topic2.knowledge_check.questions).toHaveLength(1)
    expect(topic2.knowledge_check.questions[0]).toMatchObject({
      type: 'true-false',
      text: 'The sky is blue',
      correct_answer: 'true'
    })
    
    // Check Topic 3 - fill in the blank
    const topic3 = capturedRustData.topics[2]
    expect(topic3.knowledge_check).toBeDefined()
    expect(topic3.knowledge_check.enabled).toBe(true)
    expect(topic3.knowledge_check.questions).toHaveLength(1)
    expect(topic3.knowledge_check.questions[0]).toMatchObject({
      type: 'fill-in-the-blank',
      text: 'The capital of France is _____',
      correct_answer: 'Paris'
    })
  })

  it('should handle knowledge checks from enhanced format', async () => {
    const projectId = 'test-project'
    
    let capturedRustData: any = null
    
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'generate_scorm_enhanced') {
        capturedRustData = args.courseData
        return new Uint8Array([1, 2, 3])
      }
      throw new Error(`Unknown command: ${cmd}`)
    })

    // Enhanced format has different structure
    const courseContent = {
      title: 'Test Course',
      objectives: ['Learn stuff'],
      welcome: { title: 'Welcome', content: 'Welcome' },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic 1 content',
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'What is React?',
            options: ['A library', 'A framework', 'A language'],
            correctAnswer: 0,
            explanation: 'React is a JavaScript library'
          }
        }
      ]
    }

    await generateRustSCORM(courseContent, projectId)
    
    // Verify knowledge check is preserved
    const topic1 = capturedRustData.topics[0]
    expect(topic1.knowledge_check).toBeDefined()
    expect(topic1.knowledge_check.enabled).toBe(true)
    expect(topic1.knowledge_check.questions).toHaveLength(1)
    expect(topic1.knowledge_check.questions[0]).toMatchObject({
      type: 'multiple-choice',
      text: 'What is React?',
      options: ['A library', 'A framework', 'A language'],
      correct_answer: 'A library',
      explanation: 'React is a JavaScript library'
    })
  })

  it('should not include knowledge check when not provided', async () => {
    const projectId = 'test-project'
    
    let capturedRustData: any = null
    
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'generate_scorm_enhanced') {
        capturedRustData = args.courseData
        return new Uint8Array([1, 2, 3])
      }
      throw new Error(`Unknown command: ${cmd}`)
    })

    const courseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Topic 1 content'
          // No knowledgeCheck
        }
      ]
    }

    await generateRustSCORM(courseContent, projectId)
    
    // Verify no knowledge check
    const topic1 = capturedRustData.topics[0]
    expect(topic1.knowledge_check).toBeUndefined()
  })
})