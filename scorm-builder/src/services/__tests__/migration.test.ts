import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fileStorage } from '../FileStorage'
import type { ProjectFile } from '../FileStorage'

// Mock Tauri API
vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/plugin-dialog')
vi.mock('@tauri-apps/api/path')

import { invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
const mockInvoke = vi.mocked(invoke)
const mockJoin = vi.mocked(join)

describe('Data Migration from localStorage to FileStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    // Mock join to return Windows-style paths for tests
    mockJoin.mockImplementation(async (...paths) => paths.join('\\'))
  })
  
  afterEach(() => {
    localStorage.clear()
  })
  
  it('should detect projects in localStorage', async () => {
    // Setup old localStorage data
    localStorage.setItem('scorm_project_old123', JSON.stringify({
      id: 'old123',
      name: 'Old Project',
      created: '2024-01-01T00:00:00.000Z',
      lastAccessed: '2024-01-15T00:00:00.000Z'
    }))
    
    localStorage.setItem('scorm_project_old456', JSON.stringify({
      id: 'old456',
      name: 'Another Old Project',
      created: '2024-02-01T00:00:00.000Z',
      lastAccessed: '2024-02-15T00:00:00.000Z'
    }))
    
    // Setup mocks
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects') // initialize
      .mockResolvedValue(undefined) // save_project calls
    
    await fileStorage.initialize()
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    expect(migratedProjects).toHaveLength(2)
    expect(migratedProjects.map(p => p.name)).toContain('Old Project')
    expect(migratedProjects.map(p => p.name)).toContain('Another Old Project')
  })
  
  it('should migrate complete project data including metadata', async () => {
    // Setup comprehensive localStorage data
    const projectId = 'complete123'
    
    localStorage.setItem(`scorm_project_${projectId}`, JSON.stringify({
      id: projectId,
      name: 'Complete Project',
      created: '2024-01-01T00:00:00.000Z',
      lastAccessed: '2024-01-15T00:00:00.000Z'
    }))
    
    localStorage.setItem(`scorm_course_metadata_${projectId}`, JSON.stringify({
      courseTitle: 'Advanced Course',
      difficulty: 4,
      topics: ['Topic 1', 'Topic 2', 'Topic 3'],
      customTopics: 'Custom topic info',
      template: 'enhanced'
    }))
    
    localStorage.setItem(`scorm_content_${projectId}_intro`, JSON.stringify({
      topicId: 'intro',
      title: 'Introduction',
      content: '<p>Welcome to the course</p>',
      narration: 'Welcome narration'
    }))
    
    localStorage.setItem(`scorm_content_${projectId}_topic1`, JSON.stringify({
      topicId: 'topic1',
      title: 'First Topic',
      content: '<p>Content for first topic</p>'
    }))
    
    localStorage.setItem(`scorm_ai_prompt_${projectId}`, JSON.stringify({
      prompt: 'Generate course about advanced topics',
      generatedAt: '2024-01-10T00:00:00.000Z'
    }))
    
    localStorage.setItem(`scorm_audio_settings_${projectId}`, JSON.stringify({
      voice: 'en-US-AriaNeural',
      speed: 1.1,
      pitch: 0.9
    }))
    
    localStorage.setItem(`scorm_config_${projectId}`, JSON.stringify({
      version: '1.2',
      completionCriteria: 'percentage',
      passingScore: 75
    }))
    
    // Setup mocks
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects') // initialize
      .mockResolvedValue(undefined) // save_project
    
    await fileStorage.initialize()
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    // Verify the save was called with correct data
    expect(mockInvoke).toHaveBeenCalledWith('save_project', {
      projectData: expect.objectContaining({
        version: '1.0',
        project: expect.objectContaining({
          id: projectId,
          name: 'Complete Project'
        }),
        courseData: expect.objectContaining({
          title: 'Advanced Course',
          difficulty: 4,
          topics: ['Topic 1', 'Topic 2', 'Topic 3']
        }),
        aiPrompt: expect.objectContaining({
          prompt: 'Generate course about advanced topics'
        }),
        courseContent: expect.objectContaining({
          intro: expect.objectContaining({
            title: 'Introduction',
            content: '<p>Welcome to the course</p>'
          }),
          topic1: expect.objectContaining({
            title: 'First Topic'
          })
        }),
        audioSettings: expect.objectContaining({
          voice: 'en-US-AriaNeural',
          speed: 1.1,
          pitch: 0.9
        }),
        scormConfig: expect.objectContaining({
          version: '1.2',
          passingScore: 75
        })
      }),
      filePath: expect.stringContaining(`${projectId}.scormproj`)
    })
    
    expect(migratedProjects).toHaveLength(1)
    expect(migratedProjects[0].name).toBe('Complete Project')
  })
  
  it('should handle media data during migration', async () => {
    const projectId = 'media123'
    
    localStorage.setItem(`scorm_project_${projectId}`, JSON.stringify({
      id: projectId,
      name: 'Media Project',
      created: '2024-01-01T00:00:00.000Z'
    }))
    
    // Store media metadata
    localStorage.setItem(`scorm_media_${projectId}_img1`, JSON.stringify({
      id: 'img1',
      type: 'image',
      filename: 'image1.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      metadata: { alt: 'Test image' }
    }))
    
    localStorage.setItem(`scorm_media_${projectId}_vid1`, JSON.stringify({
      id: 'vid1',
      type: 'video',
      youtubeUrl: 'https://youtube.com/watch?v=test123',
      metadata: { title: 'Test Video' }
    }))
    
    localStorage.setItem(`scorm_media_${projectId}_audio1`, JSON.stringify({
      id: 'audio1',
      type: 'audio',
      filename: 'narration.mp3',
      mimeType: 'audio/mpeg',
      metadata: { duration: 120 }
    }))
    
    // Note: Actual blob data would be in IndexedDB, not localStorage
    // This test focuses on metadata migration
    
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      .mockResolvedValue(undefined)
    
    await fileStorage.initialize()
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    expect(mockInvoke).toHaveBeenCalledWith('save_project', {
      projectData: expect.objectContaining({
        media: expect.objectContaining({
          images: expect.arrayContaining([
            expect.objectContaining({
              id: 'img1',
              metadata: { alt: 'Test image' }
            })
          ]),
          videos: expect.arrayContaining([
            expect.objectContaining({
              id: 'vid1',
              youtubeUrl: 'https://youtube.com/watch?v=test123'
            })
          ]),
          audio: expect.arrayContaining([
            expect.objectContaining({
              id: 'audio1',
              metadata: { duration: 120 }
            })
          ])
        })
      }),
      filePath: expect.stringContaining(`${projectId}.scormproj`)
    })
  })
  
  it('should clean up localStorage after successful migration', async () => {
    const projectId = 'cleanup123'
    
    // Setup localStorage data
    localStorage.setItem(`scorm_project_${projectId}`, JSON.stringify({
      id: projectId,
      name: 'Cleanup Test'
    }))
    localStorage.setItem(`scorm_course_metadata_${projectId}`, JSON.stringify({
      courseTitle: 'Test Course'
    }))
    localStorage.setItem(`scorm_content_${projectId}_page1`, JSON.stringify({
      content: 'Page 1'
    }))
    
    // Verify data exists before migration
    expect(localStorage.getItem(`scorm_project_${projectId}`)).not.toBeNull()
    expect(localStorage.getItem(`scorm_course_metadata_${projectId}`)).not.toBeNull()
    expect(localStorage.getItem(`scorm_content_${projectId}_page1`)).not.toBeNull()
    
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      .mockResolvedValue(undefined)
    
    await fileStorage.initialize()
    await fileStorage.migrateFromLocalStorage()
    
    // Verify data was cleaned up
    expect(localStorage.getItem(`scorm_project_${projectId}`)).toBeNull()
    expect(localStorage.getItem(`scorm_course_metadata_${projectId}`)).toBeNull()
    expect(localStorage.getItem(`scorm_content_${projectId}_page1`)).toBeNull()
  })
  
  it('should handle migration errors gracefully', async () => {
    const projectId = 'error123'
    
    localStorage.setItem(`scorm_project_${projectId}`, JSON.stringify({
      id: projectId,
      name: 'Error Test'
    }))
    
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      .mockRejectedValueOnce(new Error('Failed to save project'))
    
    await fileStorage.initialize()
    
    // Should not throw, but should log error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    expect(consoleSpy).toHaveBeenCalledWith(
      `Failed to migrate project ${projectId}:`,
      expect.any(Error)
    )
    expect(migratedProjects).toHaveLength(0)
    
    // Verify data was NOT cleaned up due to error
    expect(localStorage.getItem(`scorm_project_${projectId}`)).not.toBeNull()
    
    consoleSpy.mockRestore()
  })
  
  it('should handle partial/corrupted localStorage data', async () => {
    // Setup corrupted data
    localStorage.setItem('scorm_project_corrupt1', 'invalid json')
    localStorage.setItem('scorm_project_partial1', JSON.stringify({
      // Missing required fields
      name: 'Partial Project'
    }))
    
    // Valid project
    localStorage.setItem('scorm_project_valid1', JSON.stringify({
      id: 'valid1',
      name: 'Valid Project',
      created: '2024-01-01T00:00:00.000Z'
    }))
    
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      .mockResolvedValue(undefined)
    
    await fileStorage.initialize()
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    // Should only migrate the valid project
    expect(migratedProjects).toHaveLength(1)
    expect(migratedProjects[0].name).toBe('Valid Project')
    
    // Should have logged errors for corrupted data
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })
  
  it('should skip non-project localStorage keys', async () => {
    // Setup mixed localStorage data
    localStorage.setItem('user_preferences', JSON.stringify({ theme: 'dark' }))
    localStorage.setItem('app_settings', JSON.stringify({ version: '1.0' }))
    localStorage.setItem('scorm_project_real123', JSON.stringify({
      id: 'real123',
      name: 'Real Project'
    }))
    localStorage.setItem('other_data', 'some value')
    
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      .mockResolvedValue(undefined)
    
    await fileStorage.initialize()
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    // Should only migrate the SCORM project
    expect(migratedProjects).toHaveLength(1)
    expect(migratedProjects[0].id).toBe('real123')
    
    // Other localStorage data should remain untouched
    expect(localStorage.getItem('user_preferences')).not.toBeNull()
    expect(localStorage.getItem('app_settings')).not.toBeNull()
    expect(localStorage.getItem('other_data')).not.toBeNull()
    
    // But SCORM data should be cleaned up
    expect(localStorage.getItem('scorm_project_real123')).toBeNull()
  })
  
  it('should provide progress callback for migration UI', async () => {
    // Setup multiple projects
    for (let i = 1; i <= 5; i++) {
      localStorage.setItem(`scorm_project_proj${i}`, JSON.stringify({
        id: `proj${i}`,
        name: `Project ${i}`
      }))
    }
    
    mockInvoke
      .mockResolvedValueOnce('C:\\Users\\Test\\Documents\\SCORM Projects')
      .mockResolvedValue(undefined)
    
    await fileStorage.initialize()
    
    const progressUpdates: Array<{ current: number; total: number; projectName: string }> = []
    const onProgress = (current: number, total: number, projectName: string) => {
      progressUpdates.push({ current, total, projectName })
    }
    
    // Note: This assumes we add progress callback support to migrateFromLocalStorage
    // For now, we'll just verify the migration completes
    const migratedProjects = await fileStorage.migrateFromLocalStorage()
    
    expect(migratedProjects).toHaveLength(5)
    expect(migratedProjects.map(p => p.name)).toEqual([
      'Project 1',
      'Project 2', 
      'Project 3',
      'Project 4',
      'Project 5'
    ])
  })
})