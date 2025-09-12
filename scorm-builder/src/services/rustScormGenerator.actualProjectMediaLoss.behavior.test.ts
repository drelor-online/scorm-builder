/**
 * Comprehensive test for actual project media inclusion issue
 * User project should have 7 media files but only 1 is being added to SCORM
 * Project: Complex_Projects_-_1_-_49_CFR_192 (ID: 1756944000180)
 * Expected: 4 images + 3 YouTube videos = 7 total media items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertToRustFormat, convertEnhancedToRustFormat } from './rustScormGenerator'
import type { CourseContent, EnhancedCourseContent } from '../types/project'

describe('Actual Project Media Loss Investigation', () => {
  const PROJECT_ID = '1756944000180' // User's actual project ID
  
  // Mock the user's actual media data based on their project files
  const mockMediaItems = [
    // Images (4 total)
    { id: 'image-0' }, // welcome page
    { id: 'image-3' }, 
    { id: 'image-4' }, 
    { id: 'image-5' },
    
    // YouTube Videos (3 total)
    { id: 'video-1' }, // clipped 30-60s, learning-objectives
    { id: 'video-2' }, // no clipping, topic-0  
    { id: 'video-6' }  // clipped 60-89s, topic-4
  ]
  
  // Mock metadata for each media item based on user's actual files
  const mockMediaData = {
    'image-0': {
      metadata: { mimeType: 'image/jpeg' },
      data: new ArrayBuffer(1024) // Mock image data
    },
    'image-3': {
      metadata: { mimeType: 'image/jpeg' },
      data: new ArrayBuffer(2048)
    },
    'image-4': {
      metadata: { mimeType: 'image/jpeg' },
      data: new ArrayBuffer(1536)
    },
    'image-5': {
      metadata: { mimeType: 'image/jpeg' },
      data: new ArrayBuffer(2048)
    },
    'video-1': {
      metadata: { mimeType: 'text/plain' }, // YouTube metadata stored as JSON
      data: new TextEncoder().encode(JSON.stringify({
        page_id: 'learning-objectives',
        type: 'youtube',
        original_name: 'unknown',
        mime_type: 'text/plain',
        source: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=tM-Q-YvF-ns',
        title: 'TC Energy — Coastal GasLink Pipeline — Pipeline Safety',
        clip_start: 30,
        clip_end: 60
      }))
    },
    'video-2': {
      metadata: { mimeType: 'text/plain' },
      data: new TextEncoder().encode(JSON.stringify({
        page_id: 'topic-0',
        type: 'youtube',
        original_name: 'unknown',
        mime_type: 'text/plain',
        source: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=2ig_bliXMW0',
        title: 'What Is Title 49 Code Of Federal Regulations? - CountyOffice.org',
        clip_start: null,
        clip_end: null
      }))
    },
    'video-6': {
      metadata: { mimeType: 'text/plain' },
      data: new TextEncoder().encode(JSON.stringify({
        page_id: 'topic-4',
        type: 'youtube',
        original_name: 'unknown',
        mime_type: 'text/plain',
        source: 'youtube',
        embed_url: 'https://www.youtube.com/watch?v=TvB8QQibvco',
        title: 'Pipeline DOT Part 192 Hoop Stress',
        clip_start: 60,
        clip_end: 89
      }))
    }
  }
  
  beforeEach(() => {
    // Mock MediaService to return user's actual project data
    vi.doMock('./MediaService', () => ({
      createMediaService: () => ({
        listAllMedia: vi.fn().mockResolvedValue(mockMediaItems),
        getMedia: vi.fn().mockImplementation((id: string) => {
          const data = mockMediaData[id as keyof typeof mockMediaData]
          if (!data) {
            throw new Error(`Media not found: ${id}`)
          }
          return Promise.resolve(data)
        })
      })
    }))
  })

  it('should reproduce the issue: only 1 media file added instead of 7', async () => {
    // Mock minimal course content (the issue occurs during media auto-population)
    const mockCourseContent: CourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [
        { heading: 'Topic 1' },
        { heading: 'Topic 2' },
        { heading: 'Topic 3' },
        { heading: 'Topic 4' },
        { heading: 'Topic 5' }
      ]
    }

    console.log(`[TEST] Starting conversion for project ${PROJECT_ID}`)
    console.log(`[TEST] Expected: 7 media files (4 images + 3 YouTube videos)`)
    
    // This should auto-populate all 7 media files from storage
    const result = await convertToRustFormat(mockCourseContent, PROJECT_ID)
    
    console.log(`[TEST] Actual mediaFiles.length: ${result.mediaFiles.length}`)
    console.log(`[TEST] MediaFiles:`, result.mediaFiles.map(f => f.filename))
    
    // Count different types of media
    const imageFiles = result.mediaFiles.filter(f => f.filename.includes('image-'))
    const videoJsonFiles = result.mediaFiles.filter(f => f.filename.includes('video-') && f.filename.endsWith('.json'))
    
    console.log(`[TEST] Image files found: ${imageFiles.length}`)
    console.log(`[TEST] Video JSON files found: ${videoJsonFiles.length}`)
    
    // ❌ This test should fail initially, showing the bug
    expect(result.mediaFiles.length).toBeGreaterThanOrEqual(4) // At minimum, the 4 image files should be included
    
    // Ideally we want:
    // - 4 image files as binary data in mediaFiles
    // - 3 YouTube videos integrated into course content (not in mediaFiles but in course structure)
    expect(imageFiles.length).toBe(4) // All 4 images should be included
  })

  it('should show YouTube video recovery is working separately from media file inclusion', async () => {
    const mockEnhancedContent: EnhancedCourseContent = {
      projectTitle: 'Complex Projects - 1 - 49 CFR 192',
      welcome: { 
        heading: 'Welcome',
        media: [] // Should be populated by auto-recovery
      },
      objectivesPage: { 
        heading: 'Learning Objectives',
        media: [] // Should get video-1 added here
      },
      topics: [
        { heading: 'Topic 1', media: [] }, // Should get video-2 (topic-0)
        { heading: 'Topic 2', media: [] },
        { heading: 'Topic 3', media: [] },
        { heading: 'Topic 4', media: [] },
        { heading: 'Topic 5', media: [] } // Should get video-6 (topic-4)
      ]
    }

    console.log(`[TEST] Testing YouTube recovery for enhanced format`)
    
    const result = await convertEnhancedToRustFormat(mockEnhancedContent, PROJECT_ID)
    
    // Check if YouTube videos were recovered into course content
    const objectivesMedia = result.courseData.objectivesPage?.media || []
    const topic1Media = result.courseData.topics?.[0]?.media || []
    const topic5Media = result.courseData.topics?.[4]?.media || []
    
    console.log(`[TEST] Objectives media count: ${objectivesMedia.length}`)
    console.log(`[TEST] Topic 1 media count: ${topic1Media.length}`)
    console.log(`[TEST] Topic 5 media count: ${topic5Media.length}`)
    
    // Check that YouTube videos were recovered
    const video1InObjectives = objectivesMedia.find(m => m.id === 'video-1')
    const video2InTopic1 = topic1Media.find(m => m.id === 'video-2')
    const video6InTopic5 = topic5Media.find(m => m.id === 'video-6')
    
    console.log(`[TEST] video-1 recovered to objectives:`, !!video1InObjectives)
    console.log(`[TEST] video-2 recovered to topic-0:`, !!video2InTopic1)
    console.log(`[TEST] video-6 recovered to topic-4:`, !!video6InTopic5)
    
    // Verify clipping parameters are preserved
    if (video1InObjectives) {
      expect(video1InObjectives.clipStart).toBe(30)
      expect(video1InObjectives.clipEnd).toBe(60)
    }
    
    if (video6InTopic5) {
      expect(video6InTopic5.clipStart).toBe(60)
      expect(video6InTopic5.clipEnd).toBe(89)
    }
  })

  it('should demonstrate the complete media inclusion flow', async () => {
    // This test shows what SHOULD happen for complete media inclusion
    const mockContent: CourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [
        { heading: 'Topic 1' },
        { heading: 'Topic 2' },
        { heading: 'Topic 3' },
        { heading: 'Topic 4' },
        { heading: 'Topic 5' }
      ]
    }

    console.log(`[TEST] Testing complete media inclusion flow`)
    
    const result = await convertToRustFormat(mockContent, PROJECT_ID)
    
    // What we should get:
    // 1. All 4 images should be in mediaFiles array as binary data
    const images = result.mediaFiles.filter(f => f.filename.startsWith('image-'))
    console.log(`[TEST] Images in mediaFiles: ${images.length}`)
    console.log(`[TEST] Image filenames:`, images.map(f => f.filename))
    
    // 2. All 3 YouTube videos should be integrated into course content
    // (This is harder to test without examining the full course data structure)
    
    // 3. Total media handling should account for all 7 items
    console.log(`[TEST] Total mediaFiles: ${result.mediaFiles.length}`)
    console.log(`[TEST] All filenames:`, result.mediaFiles.map(f => f.filename))
    
    // The bug: we expect 4+ files but probably only get 1
    expect(result.mediaFiles.length).toBe(4) // Should be exactly 4 image files
    
    // Verify each expected image is present
    expect(result.mediaFiles.some(f => f.filename.includes('image-0'))).toBe(true)
    expect(result.mediaFiles.some(f => f.filename.includes('image-3'))).toBe(true)
    expect(result.mediaFiles.some(f => f.filename.includes('image-4'))).toBe(true)
    expect(result.mediaFiles.some(f => f.filename.includes('image-5'))).toBe(true)
  })
})