/**
 * Test case: SCORM packages showing 404 errors for media files (image-3.jpg, image-4.jpg, etc.)
 * 
 * ISSUE REPRODUCTION:
 * - Media files referenced in HTML content: image-3.jpg, image-4.jpg, image-5.jpg, video-6.bin
 * - But files return 404 errors when SCORM loads in browser
 * - Root cause: mediaFiles array is undefined when passed to Rust backend
 * - Fallback disk loading fails because media is in MediaService, not on disk
 * 
 * Expected behavior: Media files should be included in SCORM ZIP package
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { EnhancedCourseContent } from '../types/scorm'

// Mock browser environment
Object.defineProperty(global, 'window', {
  value: {
    navigator: {
      userAgent: 'test'
    },
    location: {
      href: 'http://localhost:3000'
    }
  },
  writable: true
})

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

// Mock blobUrlManager
vi.mock('../utils/blobUrlManager', () => ({
  blobUrlManager: {
    lockAll: vi.fn(),
    unlockAll: vi.fn()
  }
}))

// Import after mocking
import { generateRustSCORM } from './rustScormGenerator'
import { createMediaService } from './MediaService'
import { invoke } from '@tauri-apps/api/core'

describe('SCORM Media 404 Fix', () => {
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

  it('should reproduce 404 error scenario and verify media files are passed to backend', async () => {
    // Arrange: Create course content that matches the user's failing SCORM
    const courseContent: EnhancedCourseContent = {
      title: 'Complex CFR 192 Course', // Matches user's course
      topics: [
        {
          id: 'topic-0',
          title: 'Introduction',
          content: 'Introduction content with <img src="media/image-3.jpg" />',
          media: [
            { id: 'image-3', type: 'image', url: '', title: 'Intro Image' }
          ]
        },
        {
          id: 'topic-1', 
          title: 'Safety Requirements',
          content: 'Safety content with <img src="media/image-3.jpg" /> and <img src="media/image-4.jpg" />',
          media: [
            { id: 'image-3', type: 'image', url: '', title: 'Safety Image 1' },
            { id: 'image-4', type: 'image', url: '', title: 'Safety Image 2' }
          ]
        },
        {
          id: 'topic-2',
          title: 'Procedures', 
          content: 'Procedures with <img src="media/image-4.jpg" /> and <img src="media/image-5.jpg" />',
          media: [
            { id: 'image-4', type: 'image', url: '', title: 'Procedure Image 1' },
            { id: 'image-5', type: 'image', url: '', title: 'Procedure Image 2' }
          ]
        },
        {
          id: 'topic-3',
          title: 'Training Video',
          content: 'Training with <img src="media/image-5.jpg" /> and <video src="media/video-6.bin"></video>',
          media: [
            { id: 'image-5', type: 'image', url: '', title: 'Training Image' },
            { id: 'video-6', type: 'video', url: '', title: 'Training Video' }
          ]
        }
      ],
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        media: []
      },
      objectives: ['Learn CFR 192 requirements'],
      objectivesPage: {
        media: []
      }
    }

    // Mock MediaService to simulate successful media storage/retrieval
    // This represents the scenario where media exists in MediaService but isn't reaching SCORM
    const mediaList = [
      { id: 'image-3', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-4', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-5', metadata: { mimeType: 'image/jpeg' } },
      { id: 'video-6', metadata: { mimeType: 'application/json' } }
    ]
    
    ;(mockMediaService.listAllMedia as any).mockResolvedValue(mediaList)
    
    // Mock getMedia to return actual file data
    ;(mockMediaService.getMedia as any).mockImplementation(async (mediaId: string) => {
      const mockMediaData = {
        'image-3': { 
          data: new ArrayBuffer(50000), // Simulate 50KB image
          metadata: { mimeType: 'image/jpeg' } 
        },
        'image-4': { 
          data: new ArrayBuffer(75000), // Simulate 75KB image  
          metadata: { mimeType: 'image/jpeg' } 
        },
        'image-5': { 
          data: new ArrayBuffer(60000), // Simulate 60KB image
          metadata: { mimeType: 'image/jpeg' } 
        },
        'video-6': { 
          data: new TextEncoder().encode(JSON.stringify({ 
            url: 'https://youtube.com/watch?v=training123' 
          })), 
          metadata: { mimeType: 'application/json' } 
        }
      }
      
      console.log(`Test mock: getMedia called for ${mediaId}`)
      return mockMediaData[mediaId as keyof typeof mockMediaData]
    })

    // Act: Generate SCORM package
    await generateRustSCORM(courseContent, 'complex-project-123')

    // Assert: Verify that media files are properly passed to the Rust backend
    expect(mockInvoke).toHaveBeenCalledWith('generate_scorm_enhanced', {
      courseData: expect.any(Object),
      projectId: 'complex-project-123',
      mediaFiles: expect.any(Array) // Should be an array, NOT undefined
    })

    // Get the actual call arguments
    const callArgs = mockInvoke.mock.calls[0][1]
    
    // Critical assertion: mediaFiles should NOT be undefined (current bug)
    expect(callArgs.mediaFiles).not.toBeUndefined()
    expect(Array.isArray(callArgs.mediaFiles)).toBe(true)
    
    // Should include the expected media files with correct filenames
    expect(callArgs.mediaFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: 'image-3.jpg',
          content: expect.any(Uint8Array)
        }),
        expect.objectContaining({
          filename: 'image-4.jpg', 
          content: expect.any(Uint8Array)
        }),
        expect.objectContaining({
          filename: 'image-5.jpg',
          content: expect.any(Uint8Array)
        }),
        expect.objectContaining({
          filename: 'video-6.bin',
          content: expect.any(Uint8Array)
        })
      ])
    )

    // Verify the exact files that were causing 404 errors are included
    const filenames = callArgs.mediaFiles.map((f: any) => f.filename)
    expect(filenames).toContain('image-3.jpg')
    expect(filenames).toContain('image-4.jpg') 
    expect(filenames).toContain('image-5.jpg')
    expect(filenames).toContain('video-6.bin')
  })

  it('should handle empty media gracefully by passing empty array instead of undefined', async () => {
    // Arrange: Course content with no media
    const courseContent: EnhancedCourseContent = {
      title: 'No Media Course',
      topics: [
        {
          id: 'topic-1',
          title: 'Text Only',
          content: 'Just text content',
          media: [] // Empty media array
        }
      ],
      welcome: {
        title: 'Welcome',
        content: 'Welcome text',
        media: []
      },
      objectives: ['Learn text-only content'],
      objectivesPage: {
        media: []
      }
    }

    // Mock empty MediaService
    ;(mockMediaService.listAllMedia as any).mockResolvedValue([])
    ;(mockMediaService.getMedia as any).mockResolvedValue(null)

    // Act: Generate SCORM
    await generateRustSCORM(courseContent, 'text-only-project')

    // Assert: Should pass empty array, not undefined
    const callArgs = mockInvoke.mock.calls[0][1]
    expect(callArgs.mediaFiles).not.toBeUndefined()
    expect(Array.isArray(callArgs.mediaFiles)).toBe(true)
    expect(callArgs.mediaFiles.length).toBe(0)
  })
})