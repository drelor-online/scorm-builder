import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

describe('FileStorage - Metadata Field Mapping', () => {
  let storage: FileStorage
  
  beforeEach(() => {
    vi.clearAllMocks()
    storage = new FileStorage()
    // Set up storage with a project
    ;(storage as any)._currentProjectPath = '/test/project.scormproj'
    ;(storage as any)._currentProjectId = 'test-id'
  })

  describe('saveCourseMetadata', () => {
    it('should correctly map courseTitle to title when saving metadata', async () => {
      const mockProjectFile = {
        project: { id: 'test-id', name: 'Test Project' },
        course_data: {
          title: 'Old Title',
          difficulty: 1,
          template: 'default',
          topics: [],
          custom_topics: null
        }
      }
      
      ;(invoke as any).mockResolvedValueOnce(mockProjectFile) // load_project
      ;(invoke as any).mockResolvedValueOnce(undefined) // save_project
      
      await storage.saveCourseMetadata({
        courseTitle: 'New Course Title',
        difficulty: 3,
        topics: ['Topic 1', 'Topic 2'],
        template: 'advanced'
      })
      
      // Check that save_project was called with correct field mapping
      expect(invoke).toHaveBeenCalledWith('save_project', expect.objectContaining({
        filePath: '/test/project.scormproj',
        projectData: expect.objectContaining({
          course_data: expect.objectContaining({
            title: 'New Course Title', // Should be mapped from courseTitle
            difficulty: 3,
            template: 'advanced',
            topics: ['Topic 1', 'Topic 2'],
            custom_topics: null // Should be included even if not provided
          })
        })
      }))
    })

    it('should include custom_topics field even when not provided', async () => {
      const mockProjectFile = {
        project: { id: 'test-id', name: 'Test Project' },
        course_data: {
          title: 'Title',
          difficulty: 1,
          template: 'default',
          topics: [],
          custom_topics: null
        }
      }
      
      ;(invoke as any).mockResolvedValueOnce(mockProjectFile)
      ;(invoke as any).mockResolvedValueOnce(undefined)
      
      await storage.saveCourseMetadata({
        title: 'Course Title',
        difficulty: 2,
        topics: ['Topic 1'],
        template: 'standard'
        // Note: custom_topics not provided
      })
      
      expect(invoke).toHaveBeenCalledWith('save_project', expect.objectContaining({
        projectData: expect.objectContaining({
          course_data: expect.objectContaining({
            custom_topics: null // Should still be included
          })
        })
      }))
    })

    it('should handle both title and courseTitle fields', async () => {
      const mockProjectFile = {
        project: { id: 'test-id', name: 'Test Project' },
        course_data: {
          title: 'Old',
          difficulty: 1,
          template: 'default',
          topics: [],
          custom_topics: null
        }
      }
      
      ;(invoke as any).mockResolvedValueOnce(mockProjectFile)
      ;(invoke as any).mockResolvedValueOnce(undefined)
      
      // Test with 'title' field
      await storage.saveCourseMetadata({
        title: 'Title Field Value',
        difficulty: 2,
        topics: [],
        template: 'standard'
      })
      
      expect(invoke).toHaveBeenLastCalledWith('save_project', expect.objectContaining({
        projectData: expect.objectContaining({
          course_data: expect.objectContaining({
            title: 'Title Field Value'
          })
        })
      }))
      
      // Reset mocks
      vi.clearAllMocks()
      ;(invoke as any).mockResolvedValueOnce(mockProjectFile)
      ;(invoke as any).mockResolvedValueOnce(undefined)
      
      // Test with 'courseTitle' field (should take precedence)
      await storage.saveCourseMetadata({
        courseTitle: 'CourseTitle Field Value',
        title: 'Should be ignored',
        difficulty: 2,
        topics: [],
        template: 'standard'
      })
      
      expect(invoke).toHaveBeenLastCalledWith('save_project', expect.objectContaining({
        projectData: expect.objectContaining({
          course_data: expect.objectContaining({
            title: 'CourseTitle Field Value' // courseTitle should take precedence
          })
        })
      }))
    })
  })

  describe('saveContent with metadata contentId', () => {
    it('should handle metadata content with proper field mapping', async () => {
      const mockProjectFile = {
        project: { id: 'test-id', name: 'Test Project' },
        course_data: {
          title: 'Old',
          difficulty: 1,
          template: 'default',
          topics: [],
          custom_topics: null
        }
      }
      
      ;(invoke as any).mockResolvedValueOnce(mockProjectFile)
      ;(invoke as any).mockResolvedValueOnce(undefined)
      
      await storage.saveContent('metadata', {
        courseTitle: 'From SaveContent',
        difficulty: 4,
        topics: ['A', 'B', 'C'],
        template: 'custom'
      })
      
      expect(invoke).toHaveBeenCalledWith('save_project', expect.objectContaining({
        projectData: expect.objectContaining({
          course_data: expect.objectContaining({
            title: 'From SaveContent', // Should map courseTitle to title
            difficulty: 4,
            topics: ['A', 'B', 'C'],
            template: 'custom',
            custom_topics: null
          })
        })
      }))
    })
  })
})