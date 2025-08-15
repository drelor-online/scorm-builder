import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('FileStorage - Course Content Loading', () => {
  let storage: FileStorage
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new FileStorage()
  })

  it('should return course_content directly when it has all required fields', async () => {
    const expectedContent = {
      assessment: { questions: [], passMark: 80 },
      welcomePage: { id: 'welcome', title: 'Welcome', content: 'Welcome content' },
      learningObjectivesPage: { id: 'objectives', title: 'Objectives', content: 'Objectives content' },
      topics: [{ id: 'topic-1', title: 'Topic 1', content: 'Content 1' }]
    }

    const projectFile = {
      project: { id: 'test-123' },
      course_data: { title: 'Test Course' },
      course_content: expectedContent
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toEqual(expectedContent)
  })

  it('should NOT parse rawJson when it is not in course_content', async () => {
    const courseContent = {
      assessment: { questions: [], passMark: 80 },
      welcomePage: { id: 'welcome', title: 'Welcome', content: 'Welcome' },
      learningObjectivesPage: { id: 'objectives', title: 'Objectives', content: 'Objectives' },
      topics: [{ id: 'topic-1', title: 'Topic 1' }]
    }

    // Simulate real project structure where rawJson is in json_import_data, not course_content
    const projectFile = {
      project: { id: 'test-456' },
      course_data: { title: 'Test Course' },
      course_content: courseContent,
      json_import_data: {
        rawJson: JSON.stringify({ someOtherData: 'test' }),
        isLocked: true
      }
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    // Should return course_content as-is, not parse json_import_data's rawJson
    expect(content).toEqual(courseContent)
  })

  it('should handle course_content with fields in different order', async () => {
    // Simulate how JSON might order fields differently
    const courseContent = {
      assessment: { questions: [{ id: 'q1', question: 'Test?' }], passMark: 80 },
      learningObjectivesPage: { id: 'objectives', content: 'Objectives' },
      topics: [{ id: 'topic-1' }],
      welcomePage: { id: 'welcome', content: 'Welcome' }
    }

    const projectFile = {
      project: { id: 'test-789' },
      course_content: courseContent
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toHaveProperty('assessment')
    expect(content).toHaveProperty('welcomePage')
    expect(content).toHaveProperty('learningObjectivesPage')
    expect(content).toHaveProperty('topics')
  })

  it('should only parse rawJson for json-import-data, not course-content', async () => {
    const jsonData = { test: 'data' }
    
    const projectFile = {
      project: { id: 'test-import' },
      json_import_data: {
        rawJson: JSON.stringify(jsonData),
        isLocked: true
      }
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('json-import-data')
    
    // json-import-data should return the whole object including rawJson
    expect(content).toHaveProperty('rawJson')
    expect(content).toHaveProperty('isLocked')
  })

  it('should validate course_content has required fields', async () => {
    const consoleSpy = vi.spyOn(console, 'warn')
    
    // Missing topics field
    const incompleteContent = {
      assessment: { questions: [], passMark: 80 },
      welcomePage: { id: 'welcome' },
      learningObjectivesPage: { id: 'objectives' }
      // topics is missing
    }

    const projectFile = {
      project: { id: 'test-incomplete' },
      course_content: incompleteContent
    }

    mockInvoke.mockResolvedValueOnce(projectFile)
    
    const content = await storage.getContent('course-content')
    
    expect(content).toEqual(incompleteContent)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing required field: topics')
    )
  })
})