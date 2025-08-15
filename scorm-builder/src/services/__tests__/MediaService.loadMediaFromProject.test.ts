import { describe, it, expect, beforeEach, vi } from 'vitest'
import MediaService from '../MediaService'
import type { MediaItem } from '../MediaService'

describe('MediaService.loadMediaFromProject', () => {
  let mediaService: MediaService
  
  beforeEach(() => {
    // Clear instances before each test
    MediaService.clearInstance('test-project')
    
    // Create a new instance
    mediaService = MediaService.getInstance({ projectId: 'test-project' })
  })
  
  it('should load audio narration data into cache', async () => {
    const audioNarrationData = {
      'welcome': {
        id: 'audio-0',
        type: 'audio',
        pageId: 'welcome',
        url: 'asset://audio-0.mp3',
        metadata: {
          fileName: 'welcome.mp3',
          uploadedAt: '2024-01-01T00:00:00Z'
        }
      },
      'objectives': {
        id: 'audio-1',
        type: 'audio',
        pageId: 'objectives',
        url: 'asset://audio-1.mp3',
        metadata: {
          fileName: 'objectives.mp3',
          uploadedAt: '2024-01-01T00:00:00Z'
        }
      }
    }
    
    // Load media from project
    await mediaService.loadMediaFromProject(audioNarrationData, null)
    
    // Check that media is in cache
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(2)
    
    // Verify audio items
    const audioItems = allMedia.filter(item => item.type === 'audio')
    expect(audioItems).toHaveLength(2)
    
    // Check specific items
    const welcomeAudio = allMedia.find(item => item.id === 'audio-0')
    expect(welcomeAudio).toBeDefined()
    expect(welcomeAudio?.pageId).toBe('welcome')
    expect(welcomeAudio?.metadata.fileName).toBe('welcome.mp3')
    
    const objectivesAudio = allMedia.find(item => item.id === 'audio-1')
    expect(objectivesAudio).toBeDefined()
    expect(objectivesAudio?.pageId).toBe('objectives')
    expect(objectivesAudio?.metadata.fileName).toBe('objectives.mp3')
  })
  
  it('should load media enhancements data into cache', async () => {
    const mediaEnhancementsData = {
      'welcome': [
        {
          id: 'img-0',
          type: 'image',
          pageId: 'welcome',
          url: 'asset://img-0.jpg',
          metadata: {
            fileName: 'welcome.jpg',
            uploadedAt: '2024-01-01T00:00:00Z'
          }
        }
      ],
      'topic-0': [
        {
          id: 'img-1',
          type: 'image',
          pageId: 'topic-0',
          url: 'asset://img-1.jpg',
          metadata: {
            fileName: 'topic1.jpg',
            uploadedAt: '2024-01-01T00:00:00Z'
          }
        },
        {
          id: 'video-0',
          type: 'video',
          pageId: 'topic-0',
          url: 'asset://video-0.mp4',
          metadata: {
            fileName: 'topic1.mp4',
            uploadedAt: '2024-01-01T00:00:00Z'
          }
        }
      ]
    }
    
    // Load media from project
    await mediaService.loadMediaFromProject(null, mediaEnhancementsData)
    
    // Check that media is in cache
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(3)
    
    // Verify image items
    const imageItems = allMedia.filter(item => item.type === 'image')
    expect(imageItems).toHaveLength(2)
    
    // Verify video items
    const videoItems = allMedia.filter(item => item.type === 'video')
    expect(videoItems).toHaveLength(1)
    
    // Check specific items
    const welcomeImage = allMedia.find(item => item.id === 'img-0')
    expect(welcomeImage).toBeDefined()
    expect(welcomeImage?.pageId).toBe('welcome')
    
    const topicVideo = allMedia.find(item => item.id === 'video-0')
    expect(topicVideo).toBeDefined()
    expect(topicVideo?.pageId).toBe('topic-0')
  })
  
  it('should load both audio and media enhancements together', async () => {
    const audioNarrationData = {
      'welcome': {
        id: 'audio-0',
        type: 'audio',
        pageId: 'welcome',
        metadata: { fileName: 'welcome.mp3' }
      }
    }
    
    const mediaEnhancementsData = {
      'welcome': [
        {
          id: 'img-0',
          type: 'image',
          pageId: 'welcome',
          metadata: { fileName: 'welcome.jpg' }
        }
      ]
    }
    
    // Load media from project
    await mediaService.loadMediaFromProject(audioNarrationData, mediaEnhancementsData)
    
    // Check that all media is in cache
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(2)
    
    // Verify we have both audio and image
    const audioItems = allMedia.filter(item => item.type === 'audio')
    expect(audioItems).toHaveLength(1)
    
    const imageItems = allMedia.filter(item => item.type === 'image')
    expect(imageItems).toHaveLength(1)
  })
  
  it('should clear cache before loading new data', async () => {
    // First load some data
    await mediaService.loadMediaFromProject({
      'welcome': {
        id: 'audio-old',
        type: 'audio',
        pageId: 'welcome',
        metadata: { fileName: 'old.mp3' }
      }
    }, null)
    
    // Verify it's there
    let allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(1)
    expect(allMedia[0].id).toBe('audio-old')
    
    // Load new data
    await mediaService.loadMediaFromProject({
      'objectives': {
        id: 'audio-new',
        type: 'audio',
        pageId: 'objectives',
        metadata: { fileName: 'new.mp3' }
      }
    }, null)
    
    // Verify old data is gone and new data is there
    allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(1)
    expect(allMedia[0].id).toBe('audio-new')
    
    // Old item should not be in cache
    const oldItem = allMedia.find(item => item.id === 'audio-old')
    expect(oldItem).toBeUndefined()
  })
  
  it('should handle media registry data for backward compatibility', async () => {
    const mediaRegistryData = {
      'audio-legacy': {
        type: 'audio',
        pageId: 'welcome',
        fileName: 'legacy.mp3',
        uploadedAt: '2024-01-01T00:00:00Z'
      },
      'img-legacy': {
        type: 'image',
        pageId: 'topic-0',
        fileName: 'legacy.jpg'
      }
    }
    
    // Load media from project with only registry data
    await mediaService.loadMediaFromProject(null, null, mediaRegistryData)
    
    // Check that media is in cache
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(2)
    
    // Check specific items
    const legacyAudio = allMedia.find(item => item.id === 'audio-legacy')
    expect(legacyAudio).toBeDefined()
    expect(legacyAudio?.type).toBe('audio')
    expect(legacyAudio?.pageId).toBe('welcome')
    
    const legacyImage = allMedia.find(item => item.id === 'img-legacy')
    expect(legacyImage).toBeDefined()
    expect(legacyImage?.type).toBe('image')
    expect(legacyImage?.pageId).toBe('topic-0')
  })
  
  it('should not duplicate items when loading from multiple sources', async () => {
    const audioNarrationData = {
      'welcome': {
        id: 'audio-0',
        type: 'audio',
        pageId: 'welcome',
        metadata: { fileName: 'welcome.mp3' }
      }
    }
    
    // Same item in registry (should be ignored as duplicate)
    const mediaRegistryData = {
      'audio-0': {
        type: 'audio',
        pageId: 'welcome',
        fileName: 'welcome.mp3'
      },
      'audio-extra': {
        type: 'audio',
        pageId: 'objectives',
        fileName: 'extra.mp3'
      }
    }
    
    // Load media from project
    await mediaService.loadMediaFromProject(audioNarrationData, null, mediaRegistryData)
    
    // Check that we don't have duplicates
    const allMedia = await mediaService.listAllMedia()
    expect(allMedia).toHaveLength(2) // Should have audio-0 and audio-extra, not duplicate audio-0
    
    // Check that audio-0 appears only once
    const audio0Items = allMedia.filter(item => item.id === 'audio-0')
    expect(audio0Items).toHaveLength(1)
    
    // Check that extra item from registry is there
    const extraItem = allMedia.find(item => item.id === 'audio-extra')
    expect(extraItem).toBeDefined()
  })
})