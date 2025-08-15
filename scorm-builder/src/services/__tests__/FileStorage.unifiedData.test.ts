import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'

describe('FileStorage Unified Data Model', () => {
  let storage: FileStorage
  
  beforeEach(() => {
    storage = new FileStorage()
    vi.clearAllMocks()
  })

  describe('Data Consistency', () => {
    it('should maintain consistency between course_seed_data and course_data.topics', async () => {
      const mockProjectFile = {
        project: {
          id: 'test-123',
          name: 'Test Project',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        },
        course_data: {
          title: 'Test Course',
          difficulty: 3,
          template: 'Safety',
          topics: [], // This should be populated from course_seed_data
          custom_topics: null
        },
        course_seed_data: {
          courseTitle: 'Test Course',
          difficulty: 3,
          template: 'Safety',
          customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
          templateTopics: []
        }
      }

      // Mock the invoke call to return our test data
      vi.mocked(invoke).mockResolvedValue(mockProjectFile)
      
      // When we get metadata, topics should be populated from course_seed_data
      const metadata = await storage.getCourseMetadata()
      
      expect(metadata).toBeDefined()
      expect(metadata.topics).toEqual(['Topic 1', 'Topic 2', 'Topic 3'])
      expect(metadata.title).toBe('Test Course')
    })

    it('should save course_seed_data and update course_data.topics simultaneously', async () => {
      const courseSeedData = {
        courseTitle: 'New Course',
        difficulty: 2,
        template: 'Technical',
        customTopics: ['New Topic 1', 'New Topic 2'],
        templateTopics: []
      }

      // Set up storage with a project
      storage['_currentProjectPath'] = 'test-path'
      storage['_currentProjectId'] = 'test-id'
      
      // Mock the load to return existing data
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: 'test-id' },
            course_data: {
              title: '',
              topics: [],
              difficulty: 1,
              template: 'default'
            }
          })
        }
        if (cmd === 'save_project') {
          // Capture what's being saved
          return Promise.resolve()
        }
        return Promise.resolve()
      })

      await storage.saveContent('courseSeedData', courseSeedData)
      
      // Verify save was called with correct structure
      expect(invoke).toHaveBeenCalledWith('save_project', expect.objectContaining({
        project_data: expect.objectContaining({
          course_seed_data: courseSeedData,
          course_data: expect.objectContaining({
            topics: ['New Topic 1', 'New Topic 2'] // Should be synchronized
          })
        })
      }))
    })

    it('should handle loading projects with empty course_data.topics by using course_seed_data', async () => {
      const mockProjectFile = {
        project: { id: 'test-id' },
        course_data: {
          title: 'Test',
          topics: [], // Empty!
          difficulty: 3,
          template: 'Safety'
        },
        course_seed_data: {
          courseTitle: 'Test',
          customTopics: ['Safety Topic 1', 'Safety Topic 2'],
          difficulty: 3,
          template: 'Safety'
        },
        course_content: {
          topics: [
            { id: 'safety-topic-1', content: 'Content 1' },
            { id: 'safety-topic-2', content: 'Content 2' }
          ]
        }
      }

      vi.mocked(invoke).mockResolvedValue(mockProjectFile)
      
      const content = await storage.getContent('course-content')
      expect(content).toBeDefined()
      expect(content.topics).toHaveLength(2)
      
      const metadata = await storage.getCourseMetadata()
      expect(metadata.topics).toEqual(['Safety Topic 1', 'Safety Topic 2'])
    })
  })

  describe('Single Source of Truth', () => {
    it('should always derive topics from course_seed_data, never store separately', async () => {
      const seedData = {
        courseTitle: 'Single Source Test',
        customTopics: ['Topic A', 'Topic B', 'Topic C'],
        difficulty: 2,
        template: 'None'
      }

      storage['_currentProjectPath'] = 'test-path'
      
      let savedData: any = null
      vi.mocked(invoke).mockImplementation((cmd, args: any) => {
        if (cmd === 'save_project') {
          savedData = args.project_data
          return Promise.resolve()
        }
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: 'test' },
            course_data: { topics: [] }
          })
        }
        return Promise.resolve()
      })

      await storage.saveContent('courseSeedData', seedData)
      
      expect(savedData).toBeDefined()
      expect(savedData.course_seed_data).toEqual(seedData)
      // course_data.topics should be synchronized
      expect(savedData.course_data.topics).toEqual(['Topic A', 'Topic B', 'Topic C'])
    })

    it('should handle all data types correctly in unified model', async () => {
      storage['_currentProjectPath'] = 'test-path'
      
      const allData = {
        courseSeedData: {
          courseTitle: 'Complete Test',
          customTopics: ['T1', 'T2'],
          difficulty: 3,
          template: 'Safety'
        },
        jsonImportData: {
          isLocked: true,
          rawJson: '{"test": true}'
        },
        activities: {
          'T1': { questions: [] },
          'T2': { questions: [] }
        },
        mediaEnhancements: {
          'page-1': { media: [] }
        },
        contentEdits: {
          'page-1': { html: '<p>Edited</p>' }
        }
      }

      let savedProjectData: any = {
        project: { id: 'test' },
        course_data: { topics: [] }
      }
      vi.mocked(invoke).mockImplementation((cmd, args: any) => {
        if (cmd === 'save_project') {
          // Merge the saved data to simulate accumulation
          savedProjectData = { ...savedProjectData, ...args.project_data }
          return Promise.resolve()
        }
        if (cmd === 'load_project') {
          // Return the accumulated saved data
          return Promise.resolve(savedProjectData)
        }
        return Promise.resolve()
      })

      // Save all data types
      await storage.saveContent('courseSeedData', allData.courseSeedData)
      await storage.saveContent('json-import-data', allData.jsonImportData)
      await storage.saveContent('activities', allData.activities)
      await storage.saveContent('media-enhancements', allData.mediaEnhancements)
      await storage.saveContent('content-edits', allData.contentEdits)

      // Verify all data is saved and topics are synchronized
      expect(savedProjectData.course_seed_data).toEqual(allData.courseSeedData)
      expect(savedProjectData.course_data.topics).toEqual(['T1', 'T2'])
      expect(savedProjectData.json_import_data).toEqual(allData.jsonImportData)
      expect(savedProjectData.activities_data).toEqual(allData.activities)
      expect(savedProjectData.media_enhancements).toEqual(allData.mediaEnhancements)
      expect(savedProjectData.content_edits).toEqual(allData.contentEdits)
    })
  })

  describe('Loading Edge Cases', () => {
    it('should handle missing course_seed_data gracefully', async () => {
      const mockProjectFile = {
        project: { id: 'test' },
        course_data: {
          title: 'Fallback Title',
          topics: ['Fallback 1', 'Fallback 2'],
          difficulty: 2,
          template: 'default'
        },
        course_seed_data: null // Missing!
      }

      vi.mocked(invoke).mockResolvedValue(mockProjectFile)
      
      const metadata = await storage.getCourseMetadata()
      
      // Should fall back to course_data.topics
      expect(metadata.topics).toEqual(['Fallback 1', 'Fallback 2'])
    })

    it('should handle both course_seed_data and course_data.topics missing', async () => {
      const mockProjectFile = {
        project: { id: 'test' },
        course_data: {
          title: 'Empty Course',
          topics: [],
          difficulty: 1,
          template: 'default'
        },
        course_seed_data: null
      }

      vi.mocked(invoke).mockResolvedValue(mockProjectFile)
      
      const metadata = await storage.getCourseMetadata()
      
      expect(metadata.topics).toEqual([])
      expect(metadata.title).toBe('Empty Course')
    })
  })
})