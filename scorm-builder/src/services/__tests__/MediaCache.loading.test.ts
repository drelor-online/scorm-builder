import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FileStorage } from '../FileStorage'
import { MediaService } from '../MediaService'

// Mock FileStorage
vi.mock('../FileStorage', () => ({
  FileStorage: vi.fn().mockImplementation(() => ({
    storeMedia: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    listMedia: vi.fn()
  }))
}))

describe('Media Cache Loading from Course Content', () => {
  let mediaService: MediaService
  let mockFileStorage: any
  
  beforeEach(() => {
    // Clear singleton instances if they exist
    if (typeof (MediaService as any).clearInstances === 'function') {
      (MediaService as any).clearInstances()
    }
    
    mockFileStorage = new FileStorage('test-project')
    mediaService = MediaService.getInstance({
      projectId: 'test-project',
      fileStorage: mockFileStorage
    })
    
    // Clear the media cache
    (mediaService as any).mediaCache.clear()
  })
  
  it('should load media items from course content media arrays', async () => {
    // This is the actual format of media in course content
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        media: [
          { id: 'img-0', type: 'image', pageId: 'welcome' },
          { id: 'audio-0', type: 'audio', pageId: 'welcome' },
          { id: 'caption-0', type: 'caption', pageId: 'welcome' }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives content',
        media: [
          { id: 'img-1', type: 'image', pageId: 'objectives' },
          { id: 'audio-1', type: 'audio', pageId: 'objectives' },
          { id: 'caption-1', type: 'caption', pageId: 'objectives' }
        ]
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: 'Topic content',
          media: [
            { id: 'img-2', type: 'image', pageId: 'topic-0' },
            { id: 'audio-2', type: 'audio', pageId: 'topic-0' }
          ]
        }
      ]
    }
    
    // Load media from course content structure
    await mediaService.loadMediaFromCourseContent(courseContent)
    
    // Get all media items
    const allMedia = await mediaService.listAllMedia()
    
    // Should have loaded all 8 media items
    expect(allMedia).toHaveLength(8)
    
    // Check specific items are loaded correctly
    const img0 = allMedia.find(m => m.id === 'img-0')
    expect(img0).toBeDefined()
    expect(img0?.type).toBe('image')
    expect(img0?.pageId).toBe('welcome')
    
    const audio1 = allMedia.find(m => m.id === 'audio-1')
    expect(audio1).toBeDefined()
    expect(audio1?.type).toBe('audio')
    expect(audio1?.pageId).toBe('objectives')
    
    const img2 = allMedia.find(m => m.id === 'img-2')
    expect(img2).toBeDefined()
    expect(img2?.type).toBe('image')
    expect(img2?.pageId).toBe('topic-0')
  })
  
  it('should properly load media for MediaEnhancementWizard getMediaForPage', async () => {
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        media: [
          { id: 'img-welcome', type: 'image', pageId: 'welcome', metadata: { fileName: 'welcome.jpg' } },
          { id: 'video-welcome', type: 'video', pageId: 'welcome', metadata: { youtubeUrl: 'https://youtube.com/watch?v=123' } }
        ]
      }
    }
    
    // Load media from course content
    await mediaService.loadMediaFromCourseContent(courseContent)
    
    // Test getMediaForPage functionality (what MediaEnhancementWizard uses)
    const mediaCache = (mediaService as any).mediaCache as Map<string, any>
    const welcomeMedia = Array.from(mediaCache.values()).filter(item => item.pageId === 'welcome')
    
    // Should find 2 media items for welcome page
    expect(welcomeMedia).toHaveLength(2)
    
    // Check image media
    const imageMedia = welcomeMedia.find(m => m.type === 'image')
    expect(imageMedia).toBeDefined()
    expect(imageMedia?.id).toBe('img-welcome')
    expect(imageMedia?.metadata?.fileName).toBe('welcome.jpg')
    
    // Check video media
    const videoMedia = welcomeMedia.find(m => m.type === 'video')
    expect(videoMedia).toBeDefined()
    expect(videoMedia?.id).toBe('video-welcome')
    expect(videoMedia?.metadata?.youtubeUrl).toBe('https://youtube.com/watch?v=123')
  })
  
  it('should handle empty media arrays gracefully', async () => {
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome content',
        media: [] // Empty media array
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: 'Objectives content'
        // No media property at all
      }
    }
    
    // Should not throw error
    await expect(mediaService.loadMediaFromCourseContent(courseContent)).resolves.not.toThrow()
    
    // Should have no media items
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(0)
  })
  
  it('should merge media from multiple sources without duplicates', async () => {
    // First load from course content
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        media: [
          { id: 'img-0', type: 'image', pageId: 'welcome' }
        ]
      }
    }
    
    await mediaService.loadMediaFromCourseContent(courseContent)
    
    // Then load from audioNarration (existing method)
    const audioNarrationData = {
      welcome: {
        id: 'audio-0',
        pageId: 'welcome',
        metadata: { fileName: 'welcome.mp3' }
      }
    }
    
    await mediaService.loadMediaFromProject(audioNarrationData, null, null)
    
    // Should have both items
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(2)
    
    const hasImage = allMedia.some(m => m.id === 'img-0' && m.type === 'image')
    const hasAudio = allMedia.some(m => m.id === 'audio-0' && m.type === 'audio')
    
    expect(hasImage).toBe(true)
    expect(hasAudio).toBe(true)
  })
})