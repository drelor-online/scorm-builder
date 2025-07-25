import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectStorage } from '../ProjectStorage'
import type { ProjectData } from '../../types/project'

describe('ProjectStorage', () => {
  let storage: ProjectStorage
  
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()
    storage = new ProjectStorage()
  })

  describe('saveProject', () => {
    it('should save a project with valid course title', async () => {
      const projectData: ProjectData = {
        courseTitle: 'Test Course',
        courseSeedData: {
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: [],
          template: 'None' as const,
          templateTopics: []
        },
        currentStep: 0,
        lastModified: new Date().toISOString(),
        mediaFiles: {},
        audioFiles: {}
      }

      const result = await storage.saveProject(projectData)
      
      expect(result.success).toBe(true)
      expect(result.projectId).toBeDefined()
    })

    it('should reject saving when courseTitle is empty string', async () => {
      const projectData: ProjectData = {
        courseTitle: '',
        courseSeedData: {
          courseTitle: 'Test Course', // This is filled but courseTitle is empty
          difficulty: 3,
          customTopics: [],
          template: 'None' as const,
          templateTopics: []
        },
        currentStep: 0,
        lastModified: new Date().toISOString(),
        mediaFiles: {},
        audioFiles: {}
      }

      const result = await storage.saveProject(projectData)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Course title is required to save project')
    })

    it('should reject saving when courseTitle is whitespace only', async () => {
      const projectData: ProjectData = {
        courseTitle: '   ',
        courseSeedData: {
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: [],
          template: 'None' as const,
          templateTopics: []
        },
        currentStep: 0,
        lastModified: new Date().toISOString(),
        mediaFiles: {},
        audioFiles: {}
      }

      const result = await storage.saveProject(projectData)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Course title is required to save project')
    })
  })
})