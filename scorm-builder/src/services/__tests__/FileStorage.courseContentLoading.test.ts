import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('FileStorage - Course Content Loading', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
  })

  it('should return course-content when requested', async () => {
    const mockProjectFile = {
      project: {
        id: 'test-123',
        name: 'Test Project'
      },
      course_data: {
        title: 'Natural Gas Safety',
        difficulty: 3,
        topics: ['Safety Fundamentals'],
        template: 'Safety'
      },
      course_content: {
        topics: [
          {
            id: 'safety-fundamentals',
            title: 'Safety Fundamentals',
            content: '<h2>Understanding Natural Gas</h2>',
            duration: 5,
            imageKeywords: ['methane'],
            knowledgeCheck: {
              questions: []
            }
          }
        ],
        welcomePage: {
          id: 'content-0',
          title: 'Welcome',
          content: '<p>Welcome</p>'
        },
        learningObjectivesPage: {
          id: 'content-1',
          title: 'Learning Objectives',
          content: '<p>Objectives</p>'
        },
        objectives: ['Learn about safety'],
        assessment: {
          questions: [],
          passMark: 80
        }
      },
      current_step: 'scorm'
    }

    ;(invoke as any).mockResolvedValue(mockProjectFile)
    
    // Set the current project path
    fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
    
    // Get course content
    const content = await fileStorage.getContent('course-content')
    
    expect(content).toBeDefined()
    expect(content).toEqual(mockProjectFile.course_content)
    expect(content.topics).toHaveLength(1)
    expect(content.topics[0].id).toBe('safety-fundamentals')
  })

  it('should return courseSeedData when it exists', async () => {
    const mockProjectFile = {
      project: {
        id: 'test-123',
        name: 'Test Project'
      },
      course_data: {
        title: 'Test Course',
        difficulty: 3,
        topics: ['Topic 1'],
        template: 'Basic'
      },
      course_seed_data: {
        courseTitle: 'Test Course',
        difficulty: 3,
        customTopics: ['Topic 1'],
        template: 'Basic',
        templateTopics: []
      }
    }

    ;(invoke as any).mockResolvedValue(mockProjectFile)
    
    fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
    
    const seedData = await fileStorage.getContent('courseSeedData')
    
    expect(seedData).toBeDefined()
    expect(seedData).toEqual(mockProjectFile.course_seed_data)
  })

  it('should return null for courseSeedData when it does not exist', async () => {
    const mockProjectFile = {
      project: {
        id: 'test-123',
        name: 'Test Project'
      },
      course_data: {
        title: 'Test Course',
        difficulty: 3,
        topics: ['Topic 1'],
        template: 'Basic'
      }
      // No course_seed_data field
    }

    ;(invoke as any).mockResolvedValue(mockProjectFile)
    
    fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
    
    const seedData = await fileStorage.getContent('courseSeedData')
    
    expect(seedData).toBeUndefined()
  })

  it('should return current step when it exists', async () => {
    const mockProjectFile = {
      project: {
        id: 'test-123',
        name: 'Test Project'
      },
      course_data: {
        title: 'Test Course',
        difficulty: 3,
        topics: [],
        template: 'Basic'
      },
      current_step: 'scorm'
    }

    ;(invoke as any).mockResolvedValue(mockProjectFile)
    
    fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
    
    const stepData = await fileStorage.getContent('currentStep')
    
    expect(stepData).toBeDefined()
    expect(stepData).toEqual({ step: 'scorm' })
  })

  it('should return metadata with topics from course_data', async () => {
    const mockProjectFile = {
      project: {
        id: 'test-123',
        name: 'Test Project'
      },
      course_data: {
        title: 'Natural Gas Safety',
        difficulty: 3,
        topics: ['Safety Fundamentals', 'Hazard Identification'],
        template: 'Safety'
      }
    }

    ;(invoke as any).mockResolvedValue(mockProjectFile)
    
    fileStorage['_currentProjectPath'] = '/path/to/project.scormproj'
    
    const metadata = await fileStorage.getCourseMetadata()
    
    expect(metadata).toBeDefined()
    expect(metadata.title).toBe('Natural Gas Safety')
    expect(metadata.topics).toEqual(['Safety Fundamentals', 'Hazard Identification'])
    expect(metadata.difficulty).toBe(3)
    expect(metadata.template).toBe('Safety')
  })
})