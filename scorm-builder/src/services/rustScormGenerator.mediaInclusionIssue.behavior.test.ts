/**
 * Test case: Media files stored in MediaService are not being included in SCORM packages
 * 
 * ISSUE REPRODUCTION:
 * - User logs show: "Found 7 media items (metadata only)" 
 * - But SCORM generation logs: "mediaFilesCount: 0"
 * - Result: SCORM package generated with no media files
 * 
 * ROOT CAUSE: Gap between MediaService storage and course content media references
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { EnhancedCourseContent } from '../types/scorm'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}))

// Mock the MediaService
vi.mock('./MediaService', () => ({
  createMediaService: () => ({
    getMedia: vi.fn(),
    listAllMedia: vi.fn(),
  })
}))

// Import after mocking
import { generateRustSCORM } from './rustScormGenerator'
import { createMediaService } from './MediaService'
import { invoke } from '@tauri-apps/api/core'

describe('SCORM Media Inclusion Issue', () => {
  let mockMediaService: ReturnType<typeof createMediaService>
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Get mock references
    mockMediaService = createMediaService('test') as any
    mockInvoke = invoke as any
    
    // Mock successful SCORM generation (returns empty array as Uint8Array)
    mockInvoke.mockResolvedValue([])
    
    // Ensure all mock methods are properly initialized
    mockMediaService.getMedia = vi.fn()
    mockMediaService.listAllMedia = vi.fn()
  })

  it('should include media files that exist in MediaService when generating SCORM', async () => {
    // Arrange: Set up course content with media references
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content with media',
          media: [
            { id: 'image-3', type: 'image', url: 'image-3' },
            { id: 'video-1', type: 'video', url: 'video-1' }
          ]
        },
        {
          id: 'topic-2', 
          title: 'Topic 2',
          content: 'More content',
          media: [
            { id: 'image-4', type: 'image', url: 'image-4' }
          ]
        }
      ],
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [
          { id: 'image-0', type: 'image', url: 'image-0' }
        ]
      },
      objectives: ['Learn something'],
      objectivesPage: {
        media: [
          { id: 'image-5', type: 'image', url: 'image-5' }
        ]
      }
    }

    // Mock MediaService to return media data (simulating real storage) 
    const mediaList = [
      { id: 'image-0', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-3', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-4', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-5', metadata: { mimeType: 'image/jpeg' } },
      { id: 'video-1', metadata: { mimeType: 'application/json' } }
    ]
    console.log('Test setup: Setting up listAllMedia mock to return:', mediaList.length, 'items')
    ;(mockMediaService.listAllMedia as any).mockResolvedValue(mediaList)
    
    ;(mockMediaService.getMedia as any).mockImplementation(async (mediaId: string) => {
      const mockMediaData = {
        'image-0': { data: new ArrayBuffer(27464), metadata: { mimeType: 'image/jpeg' } },
        'image-3': { data: new ArrayBuffer(608548), metadata: { mimeType: 'image/jpeg' } },
        'image-4': { data: new ArrayBuffer(343845), metadata: { mimeType: 'image/jpeg' } },
        'image-5': { data: new ArrayBuffer(17377), metadata: { mimeType: 'image/jpeg' } },
        'video-1': { 
          data: new TextEncoder().encode(JSON.stringify({ 
            url: 'https://youtube.com/watch?v=test123' 
          })), 
          metadata: { mimeType: 'application/json' } 
        }
      }
      return mockMediaData[mediaId]
    })

    // Act: Generate SCORM package
    await generateRustSCORM(courseContent, 'test-project')

    // Assert: Media files should be passed to Rust backend
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
      courseData: expect.any(Object),
      projectId: 'test-project',
      mediaFiles: expect.arrayContaining([
        expect.objectContaining({
          filename: expect.stringMatching(/^image-\d+\.(jpg|jpeg)$/),
          content: expect.any(Uint8Array)
        })
      ])
    })

    // Verify that mediaFiles array is NOT undefined or empty
    const callArgs = mockInvoke.mock.calls[0][1]
    expect(callArgs.mediaFiles).toBeDefined()
    expect(Array.isArray(callArgs.mediaFiles)).toBe(true)
    expect(callArgs.mediaFiles.length).toBeGreaterThan(0)

    // Should include at least the image files that were found in MediaService
    expect(callArgs.mediaFiles.length).toBeGreaterThanOrEqual(4) // 4 images + video metadata
  })

  it('should handle missing media gracefully without breaking SCORM generation', async () => {
    // Arrange: Course content references media that doesn't exist in MediaService
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1', 
          content: 'Content with missing media',
          media: [
            { id: 'missing-image', type: 'image', url: 'missing-image' }
          ]
        }
      ],
      objectives: ['Learn something']
    }

    // Mock MediaService to return empty list and null for missing media
    ;(mockMediaService.listAllMedia as any).mockResolvedValue([])
    ;(mockMediaService.getMedia as any).mockResolvedValue(null)

    // Act & Assert: Should not throw error
    await expect(generateRustSCORM(courseContent, 'test-project')).resolves.not.toThrow()

    // Should still call invoke, but with empty or undefined mediaFiles
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
      courseData: expect.any(Object),
      projectId: 'test-project',
      mediaFiles: undefined // Should be undefined when no valid media files
    })
  })

  it('should reproduce the exact issue from user logs', async () => {
    // Arrange: Simulate the exact scenario from user logs
    const courseContent: EnhancedCourseContent = {
      title: 'Complex Projects - 1 - 49 CFR 192',
      topics: Array.from({ length: 20 }, (_, i) => ({
        id: `topic-${i + 1}`,
        title: `Topic ${i + 1}`,
        content: `Content for topic ${i + 1}`,
        // Some topics have media references, some don't (realistic scenario)
        ...(i < 5 ? {
          media: [
            { id: `image-${i}`, type: 'image', url: `image-${i}` }
          ]
        } : {})
      })),
      welcome: {
        title: 'Welcome',
        content: 'Welcome content'
        // Note: No media reference here, but media exists in storage
      },
      objectives: ['Learn CFR 192']
    }

    // Mock MediaService to return the exact media from user logs
    ;(mockMediaService.listAllMedia as any).mockResolvedValue([
      { id: 'image-0', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-3', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-4', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-5', metadata: { mimeType: 'image/jpeg' } },
      { id: 'video-1', metadata: { mimeType: 'application/json' } },
      { id: 'video-2', metadata: { mimeType: 'application/json' } },
      { id: 'video-6', metadata: { mimeType: 'application/json' } }
    ])
    
    ;(mockMediaService.getMedia as any).mockImplementation(async (mediaId: string) => {
      const userLoggedMedia = {
        'image-0': { data: new ArrayBuffer(27464), metadata: { mimeType: 'image/jpeg' } },
        'image-3': { data: new ArrayBuffer(608548), metadata: { mimeType: 'image/jpeg' } },
        'image-4': { data: new ArrayBuffer(343845), metadata: { mimeType: 'image/jpeg' } },
        'image-5': { data: new ArrayBuffer(17377), metadata: { mimeType: 'image/jpeg' } },
        'video-1': { data: new TextEncoder().encode('{"url": "https://youtube.com"}'), metadata: { mimeType: 'application/json' } },
        'video-2': { data: new TextEncoder().encode('{"url": "https://youtube.com"}'), metadata: { mimeType: 'application/json' } },
        'video-6': { data: new TextEncoder().encode('{"url": "https://youtube.com"}'), metadata: { mimeType: 'application/json' } }
      }
      return userLoggedMedia[mediaId] || null
    })

    // Act
    await generateRustSCORM(courseContent, '1756944000180')

    // Assert: THIS IS THE FAILING CASE
    // Currently, mediaFiles would be empty because course content doesn't properly reference stored media
    const callArgs = mockInvoke.mock.calls[0][1]
    
    // This assertion will FAIL until we fix the media linking issue
    expect(callArgs.mediaFiles).toBeDefined()
    expect(callArgs.mediaFiles?.length).toBeGreaterThan(0)
    
    // Log the issue for debugging
    console.log('Media files passed to Rust:', callArgs.mediaFiles?.length || 0)
    console.log('Expected: 7 media files from storage')
    console.log('Actual:', callArgs.mediaFiles)
  })
})