import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ProjectStorage } from '../ProjectStorage'
import type { ProjectData } from '../../types/project'

describe('ProjectStorage - Media Persistence', () => {
  let storage: ProjectStorage
  const mockProjectData: ProjectData = {
    courseTitle: 'Test Course',
    courseSeedData: {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1', 'Topic 2'],
      template: 'None' as const,
      templateTopics: []
    },
    courseContent: {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome</p>',
        narration: 'Welcome narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<p>Objectives</p>',
        narration: 'Objectives narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Topic 1 content</p>',
        narration: 'Topic 1 narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 5,
        imageKeywords: ['safety'],
        imagePrompts: ['safety equipment'],
        videoSearchTerms: ['safety training'],
        duration: 5,
        media: [{
          id: 'media-1',
          type: 'image',
          url: 'https://example.com/image1.jpg',
          title: 'Safety Image'
        }]
      }, {
        id: 'topic-2',
        title: 'Topic 2',
        content: '<p>Topic 2 content</p>',
        narration: 'Topic 2 narration',
        imageKeywords: ['procedures'],
        imagePrompts: ['work procedures'],
        videoSearchTerms: ['procedure training'],
        duration: 5,
        media: [{
          id: 'media-2',
          type: 'video',
          url: 'https://youtube.com/watch?v=test',
          embedUrl: 'https://youtube.com/embed/test',
          title: 'Training Video'
        }]
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    },
    currentStep: 3,
    lastModified: new Date().toISOString()
  }

  beforeEach(() => {
    localStorage.clear()
    storage = new ProjectStorage()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should save and restore media attached to topics', async () => {
    // Save project with media
    const saveResult = await storage.saveProject(mockProjectData)
    expect(saveResult.success).toBe(true)
    expect(saveResult.projectId).toBeDefined()

    // Load the project
    const loadResult = await storage.loadProject(saveResult.projectId!)
    expect(loadResult.success).toBe(true)
    expect(loadResult.data).toBeDefined()

    // Check that media is preserved
    const loadedContent = loadResult.data!.courseContent as any
    expect(loadedContent.topics[0].media).toHaveLength(1)
    expect(loadedContent.topics[0].media[0]).toEqual({
      id: 'media-1',
      type: 'image',
      url: 'https://example.com/image1.jpg',
      title: 'Safety Image'
    })

    expect(loadedContent.topics[1].media).toHaveLength(1)
    expect(loadedContent.topics[1].media[0]).toEqual({
      id: 'media-2',
      type: 'video',
      url: 'https://youtube.com/watch?v=test',
      embedUrl: 'https://youtube.com/embed/test',
      title: 'Training Video'
    })
  })

  it('should handle topics with no media', async () => {
    const dataWithoutMedia = {
      ...mockProjectData,
      courseContent: {
        ...mockProjectData.courseContent!,
        topics: (mockProjectData.courseContent as any).topics.map((topic: any) => ({
          ...topic,
          media: undefined
        }))
      }
    }

    const saveResult = await storage.saveProject(dataWithoutMedia)
    expect(saveResult.success).toBe(true)

    const loadResult = await storage.loadProject(saveResult.projectId!)
    expect(loadResult.success).toBe(true)

    const loadedContent = loadResult.data!.courseContent as any
    expect(loadedContent.topics[0].media).toBeUndefined()
    expect(loadedContent.topics[1].media).toBeUndefined()
  })

  it('should preserve media when project is exported and imported', async () => {
    // Save project
    const saveResult = await storage.saveProject(mockProjectData)
    expect(saveResult.success).toBe(true)

    // Export project
    const exportResult = await storage.exportProject(saveResult.projectId!)
    expect(exportResult.success).toBe(true)
    expect(exportResult.data).toBeDefined()

    // Clear storage
    localStorage.clear()
    storage = new ProjectStorage()

    // Import project
    const importResult = await storage.importProject(exportResult.data!)
    expect(importResult.success).toBe(true)
    expect(importResult.projectId).toBeDefined()

    // Load imported project
    const loadResult = await storage.loadProject(importResult.projectId!)
    expect(loadResult.success).toBe(true)

    // Check media is preserved
    const loadedContent = loadResult.data!.courseContent as any
    expect(loadedContent.topics[0].media).toHaveLength(1)
    expect(loadedContent.topics[0].media[0].title).toBe('Safety Image')
    expect(loadedContent.topics[1].media).toHaveLength(1)
    expect(loadedContent.topics[1].media[0].title).toBe('Training Video')
  })

  it('should handle mixed media types in the same topic', async () => {
    const dataWithMixedMedia = {
      ...mockProjectData,
      courseContent: {
        ...mockProjectData.courseContent!,
        topics: [{
          ...(mockProjectData.courseContent as any).topics[0],
          media: [
            {
              id: 'image-1',
              type: 'image' as const,
              url: 'https://example.com/image.jpg',
              title: 'Image'
            },
            {
              id: 'video-1',
              type: 'video' as const,
              url: 'https://youtube.com/watch?v=abc',
              embedUrl: 'https://youtube.com/embed/abc',
              title: 'Video'
            }
          ]
        }]
      }
    }

    const saveResult = await storage.saveProject(dataWithMixedMedia)
    expect(saveResult.success).toBe(true)

    const loadResult = await storage.loadProject(saveResult.projectId!)
    expect(loadResult.success).toBe(true)

    const loadedContent = loadResult.data!.courseContent as any
    expect(loadedContent.topics[0].media).toHaveLength(2)
    expect(loadedContent.topics[0].media[0].type).toBe('image')
    expect(loadedContent.topics[0].media[1].type).toBe('video')
  })

  it('should update media when project is re-saved', async () => {
    // Initial save
    const saveResult = await storage.saveProject(mockProjectData)
    expect(saveResult.success).toBe(true)
    const projectId = saveResult.projectId!

    // Modify media
    const updatedData = {
      ...mockProjectData,
      courseContent: {
        ...mockProjectData.courseContent!,
        topics: [{
          ...(mockProjectData.courseContent as any).topics[0],
          media: [{
            id: 'new-media',
            type: 'image' as const,
            url: 'https://example.com/new-image.jpg',
            title: 'New Image'
          }]
        }, ...(mockProjectData.courseContent as any).topics.slice(1)]
      }
    }

    // Re-save with same project ID
    const updateResult = await storage.saveProject(updatedData, projectId)
    expect(updateResult.success).toBe(true)

    // Load and verify update
    const loadResult = await storage.loadProject(projectId)
    expect(loadResult.success).toBe(true)

    const loadedContent = loadResult.data!.courseContent as any
    expect(loadedContent.topics[0].media).toHaveLength(1)
    expect(loadedContent.topics[0].media[0].title).toBe('New Image')
    expect(loadedContent.topics[0].media[0].url).toBe('https://example.com/new-image.jpg')
  })
})