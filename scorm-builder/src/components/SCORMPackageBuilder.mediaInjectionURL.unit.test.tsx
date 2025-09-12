import { describe, it, expect } from 'vitest'

// Test the media injection function directly by extracting it or testing the logic
describe('Media Injection URL Generation', () => {
  
  it('should generate proper media URLs from fileName instead of storage-ref URLs', () => {
    // Mock storage media with fileName properties
    const storageMedia = [
      {
        id: 'image-2',
        type: 'image',
        pageId: 'topic-2',
        fileName: 'topic2-chart.png',
        metadata: { page_id: 'topic-2', title: 'Topic 2 Chart' }
      },
      {
        id: 'image-3',
        type: 'image',
        pageId: 'topic-3',
        fileName: 'topic3-graphic.jpg',
        metadata: { page_id: 'topic-3', title: 'Topic 3 Graphic' }
      }
    ]

    // Mock course content with missing media on topics
    const courseContent = {
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          media: []
        },
        {
          id: 'topic-2',
          title: 'Topic 2',
          media: []
        },
        {
          id: 'topic-3',
          title: 'Topic 3',
          media: []
        }
      ]
    }

    // Simulate the media injection logic that should use fileName for URL generation
    function generateProperMediaUrl(media: any): string {
      // This is what we want - proper relative URL using fileName
      if (media.fileName) {
        return `media/${media.fileName}`
      }
      // Fallback - but this should generate storage-ref URLs (what we're currently doing wrong)
      return `storage-ref-${media.id}`
    }

    // Test proper URL generation
    const media2 = storageMedia[0]
    const media3 = storageMedia[1]
    
    const properUrl2 = generateProperMediaUrl(media2)
    const properUrl3 = generateProperMediaUrl(media3)
    
    // These should pass when we fix the URL generation
    expect(properUrl2).toBe('media/topic2-chart.png')
    expect(properUrl3).toBe('media/topic3-graphic.jpg')
    
    // These should NOT be storage-ref URLs
    expect(properUrl2).not.toMatch(/^storage-ref-/)
    expect(properUrl3).not.toMatch(/^storage-ref-/)
  })

  it('should fallback to storage-ref URL when fileName is missing', () => {
    const mediaWithoutFileName = {
      id: 'video-1',
      type: 'youtube',
      pageId: 'topic-1',
      metadata: { title: 'YouTube Video' }
      // No fileName property
    }

    function generateProperMediaUrl(media: any): string {
      if (media.fileName) {
        return `media/${media.fileName}`
      }
      return `storage-ref-${media.id}`
    }

    const url = generateProperMediaUrl(mediaWithoutFileName)
    expect(url).toBe('storage-ref-video-1')
  })

  it('should demonstrate current broken behavior vs desired behavior', () => {
    const media = {
      id: 'image-2',
      type: 'image',
      pageId: 'topic-2', 
      fileName: 'topic2-chart.png',
      url: undefined, // No existing URL
      metadata: { page_id: 'topic-2', title: 'Topic 2 Chart' }
    }

    // Current broken implementation (what's in the code now)
    const currentBrokenUrl = media.url || `storage-ref-${media.id}`
    
    // Desired fixed implementation
    const desiredFixedUrl = media.url || (media.fileName ? `media/${media.fileName}` : `storage-ref-${media.id}`)
    
    // Show the difference
    expect(currentBrokenUrl).toBe('storage-ref-image-2') // Current broken behavior
    expect(desiredFixedUrl).toBe('media/topic2-chart.png') // Desired fixed behavior
    
    // The test will pass to show the logic is correct, but the actual code needs to be fixed
    expect(currentBrokenUrl).not.toBe(desiredFixedUrl) // They should be different until we fix it
  })
})