import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../services/FileStorage'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

describe('Complete Data Persistence Tests', () => {
  let mockInvoke: any
  let _mockStorage: FileStorage
  
  beforeEach(() => {
    mockInvoke = vi.fn()
    vi.mocked(invoke).mockImplementation(mockInvoke)
    
    // Create a mock storage instance
    _mockStorage = new FileStorage()
    
    // Clear localStorage
    localStorage.clear()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Course Seed Data Persistence', () => {
    it('should save complete course seed data to file storage, not localStorage', async () => {
      const courseSeedData = {
        courseTitle: 'Test Course',
        difficulty: 3,
        customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
        template: 'Safety',
        templateTopics: []
      }
      
      // Mock the save_project command
      mockInvoke.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'save_project') {
          // Verify the data includes courseSeedData
          expect(args.projectData).toHaveProperty('course_seed_data')
          expect(args.projectData.course_seed_data).toEqual(courseSeedData)
          return Promise.resolve()
        }
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: 'test-id', name: 'Test Course' },
            course_data: { title: 'Test Course', difficulty: 3 },
            course_seed_data: courseSeedData, // This field should exist
            course_content: null,
            media: { images: [], videos: [], audio: [] },
            audio_settings: { voice: 'default', speed: 1.0, pitch: 1.0 },
            scorm_config: { version: 'SCORM_2004', completion_criteria: 'all', passing_score: 80 }
          })
        }
        return Promise.resolve()
      })
      
      // Save the data
      await _mockStorage.saveContent('courseSeedData', courseSeedData)
      
      // Load it back
      const loaded = await _mockStorage.getContent('courseSeedData')
      
      // Verify it matches
      expect(loaded).toEqual(courseSeedData)
      
      // Verify localStorage was NOT used for course data
      expect(localStorage.getItem('scorm_courseSeedData')).toBeNull()
    })
  })
  
  describe('JSON Import Data Persistence', () => {
    it('should save raw JSON import and edited content to file storage', async () => {
      const jsonImportData = {
        rawJson: '{"title": "Test", "topics": []}',
        validatedContent: {
          title: 'Test Course',
          topics: [
            { id: 'topic-1', title: 'Topic 1', content: '<p>Original content</p>' }
          ]
        },
        editedContent: {
          'topic-1': '<p>Edited content with <strong>changes</strong></p>'
        }
      }
      
      mockInvoke.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'save_project') {
          // Verify JSON data is included
          expect(args.projectData).toHaveProperty('json_import_data')
          expect(args.projectData.json_import_data).toEqual(jsonImportData)
          return Promise.resolve()
        }
        if (cmd === 'load_project') {
          return Promise.resolve({
            project: { id: 'test-id', name: 'Test Course' },
            json_import_data: jsonImportData,
            course_content: jsonImportData.validatedContent,
            media: { images: [], videos: [], audio: [] },
            audio_settings: { voice: 'default', speed: 1.0, pitch: 1.0 },
            scorm_config: { version: 'SCORM_2004', completion_criteria: 'all', passing_score: 80 }
          })
        }
        return Promise.resolve()
      })
      
      // Save JSON import data
      await _mockStorage.saveContent('json-import-data', jsonImportData)
      
      // Load it back
      const loaded = await _mockStorage.getContent('json-import-data')
      
      // Verify complete data is restored
      expect(loaded).toEqual(jsonImportData)
      expect(loaded.rawJson).toBe(jsonImportData.rawJson)
      expect(loaded.editedContent['topic-1']).toContain('Edited content')
    })
  })
  
  describe('Media Enhancement Persistence', () => {
    it('should save all media enhancements to project file', async () => {
      const mediaData = {
        'welcome': {
          media: [
            { id: 'image-1', type: 'image', url: 'blob:...', storageId: 'image-1' }
          ]
        },
        'topic-1': {
          media: [
            { id: 'video-1', type: 'video', url: 'https://youtube.com/...', isYouTube: true },
            { id: 'image-2', type: 'image', url: 'blob:...', storageId: 'image-2' }
          ]
        }
      }
      
      mockInvoke.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'save_project') {
          // Verify media data is properly structured
          expect(args.projectData.media).toBeDefined()
          expect(args.projectData.media.images).toHaveLength(2)
          expect(args.projectData.media.videos).toHaveLength(1)
          return Promise.resolve()
        }
        return Promise.resolve()
      })
      
      // Save media enhancements
      await _mockStorage.saveContent('media-enhancements', mediaData)
      
      // Verify it's not in localStorage
      expect(localStorage.getItem('media-enhancements')).toBeNull()
    })
  })
  
  describe('Complete Save/Load Cycle', () => {
    it('should persist ALL data through close and reopen', async () => {
      const completeProjectData = {
        course_seed_data: {
          courseTitle: 'Complete Test',
          difficulty: 5,
          customTopics: ['Advanced Topic 1', 'Advanced Topic 2'],
          template: 'Technical'
        },
        json_import_data: {
          rawJson: '{"complete": true}',
          validatedContent: { title: 'Complete Test' }
        },
        course_content: {
          welcomePage: { 
            id: 'welcome', 
            content: '<p>Welcome</p>',
            media: [
              { id: 'audio-0', type: 'audio', storageId: 'audio-0' }
            ]
          },
          topics: [
            { 
              id: 'topic-1', 
              title: 'Topic 1',
              content: '<p>Content</p>',
              media: [
                { id: 'image-1', type: 'image', storageId: 'image-1' }
              ]
            }
          ],
          assessment: {
            questions: [
              { id: 'q1', question: 'Test?', type: 'true-false', correctAnswer: 'true' }
            ]
          }
        },
        media: {
          images: [
            { id: 'image-1', filename: 'test.jpg', relative_path: 'media/image-1.bin' }
          ],
          videos: [],
          audio: [
            { id: 'audio-0', filename: 'welcome.mp3', relative_path: 'media/audio-0.bin' }
          ],
          captions: [
            { id: 'caption-0', filename: 'welcome.vtt', relative_path: 'media/caption-0.bin' }
          ]
        },
        activities_data: {
          customQuestions: [
            { id: 'custom-1', question: 'Custom question?', answer: 'Custom answer' }
          ]
        },
        current_step: 'scorm',
        audio_settings: { voice: 'alloy', speed: 1.1, pitch: 0.9 },
        scorm_config: { version: 'SCORM_1.2', completion_criteria: 'visited', passing_score: 75 }
      }
      
      mockInvoke.mockImplementation((cmd: string, args: any) => {
        if (cmd === 'save_project') {
          // Verify ALL data is included
          const data = args.projectData
          expect(data.course_seed_data).toBeDefined()
          expect(data.json_import_data).toBeDefined()
          expect(data.course_content).toBeDefined()
          expect(data.media).toBeDefined()
          expect(data.activities_data).toBeDefined()
          expect(data.audio_settings.voice).toBe('alloy')
          return Promise.resolve()
        }
        if (cmd === 'load_project') {
          // Return complete data
          return Promise.resolve(completeProjectData)
        }
        return Promise.resolve()
      })
      
      // Save complete project
      await _mockStorage.saveContent('complete-project', completeProjectData)
      
      // Simulate closing and reopening
      localStorage.clear() // Clear any browser storage
      
      // Load project
      const loaded = await _mockStorage.getContent('complete-project')
      
      // Verify EVERYTHING is restored
      expect(loaded.course_seed_data.courseTitle).toBe('Complete Test')
      expect(loaded.course_seed_data.customTopics).toHaveLength(2)
      expect(loaded.json_import_data.rawJson).toBe('{"complete": true}')
      expect(loaded.course_content.welcomePage.media).toHaveLength(1)
      expect(loaded.media.images).toHaveLength(1)
      expect(loaded.media.audio).toHaveLength(1)
      expect(loaded.activities_data.customQuestions).toHaveLength(1)
      expect(loaded.audio_settings.voice).toBe('alloy')
      expect(loaded.scorm_config.passing_score).toBe(75)
      
      // Verify NO data in localStorage
      const localStorageKeys = Object.keys(localStorage)
      const courseDataKeys = localStorageKeys.filter(k => 
        k.includes('course') || k.includes('seed') || k.includes('json') || k.includes('media')
      )
      expect(courseDataKeys).toHaveLength(0)
    })
  })
  
  describe('localStorage Independence', () => {
    it('should not use localStorage for any course data', async () => {
      // Set up localStorage spy
      const _getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      
      mockInvoke.mockResolvedValue({
        project: { id: 'test', name: 'Test' },
        course_seed_data: { courseTitle: 'Test' },
        course_content: {},
        media: { images: [], videos: [], audio: [] }
      })
      
      // Perform save/load operations
      await _mockStorage.saveContent('test-data', { test: true })
      await _mockStorage.getContent('test-data')
      
      // Check that localStorage was not used for course data
      const setItemCalls = setItemSpy.mock.calls
      const courseDataWrites = setItemCalls.filter(([key]) => 
        key.includes('course') || key.includes('content') || key.includes('media')
      )
      
      expect(courseDataWrites).toHaveLength(0)
    })
  })
})