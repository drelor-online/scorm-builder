import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('FileStorage - Nested JSON Parsing', () => {
  let storage: FileStorage
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new FileStorage()
  })

  it('should parse course_content when stored as nested JSON string', async () => {
    const expectedContent = {
      topics: [
        { id: 'topic-1', title: 'Natural Gas Safety', content: 'Safety content here' }
      ],
      welcome: { title: 'Welcome', content: 'Welcome content' },
      objectives: { title: 'Objectives', content: 'Objectives content' }
    }

    // Simulate project file with course_content as nested JSON
    const projectFile = {
      project: { id: 'test-123' },
      course_data: { title: 'Test Course' },
      course_content: {
        rawJson: JSON.stringify(expectedContent)
      }
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toEqual(expectedContent)
  })

  it('should parse course_content when entire value is a JSON string', async () => {
    const expectedContent = {
      topics: [
        { id: 'topic-1', title: 'Topic 1', content: 'Content 1' }
      ]
    }

    // Simulate project file where course_content itself is a JSON string
    const projectFile = {
      project: { id: 'test-456' },
      course_data: { title: 'Test Course' },
      course_content: JSON.stringify(expectedContent)
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toEqual(expectedContent)
  })

  it('should handle course_content with deeply nested JSON strings', async () => {
    const expectedContent = {
      topics: [{ id: 'topic-1', title: 'Topic' }]
    }

    // Simulate double-nested JSON
    const projectFile = {
      project: { id: 'test-789' },
      course_data: { title: 'Test Course' },
      course_content: JSON.stringify({
        rawJson: JSON.stringify(expectedContent)
      })
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toEqual(expectedContent)
  })

  it('should return course_content as-is when not a JSON string', async () => {
    const expectedContent = {
      topics: [{ id: 'topic-1', title: 'Direct Topic' }]
    }

    const projectFile = {
      project: { id: 'test-direct' },
      course_data: { title: 'Test Course' },
      course_content: expectedContent
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toEqual(expectedContent)
  })

  it('should handle empty course_content gracefully', async () => {
    const projectFile = {
      project: { id: 'test-empty' },
      course_data: { title: 'Test Course' },
      course_content: null
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toBeNull()
  })

  it('should log appropriate messages during parsing', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const projectFile = {
      project: { id: 'test-log' },
      course_content: {
        rawJson: JSON.stringify({ topics: [] })
      }
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    await storage.getContent('course-content')
    
    expect(consoleSpy).toHaveBeenCalledWith('[FileStorage] Parsed nested rawJson from course_content')
  })
})