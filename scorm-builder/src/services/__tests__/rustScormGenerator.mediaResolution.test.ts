import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { MediaStore } from '../MediaStore'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock MediaStore
vi.mock('../MediaStore', () => ({
  MediaStore: {
    getMedia: vi.fn()
  }
}))

describe('rustScormGenerator - Media Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should resolve media blob URLs to file content before sending to Rust', async () => {
    const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    const projectId = 'test-project'
    
    // Mock media in MediaStore
    const mockImageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]) // PNG header
    const mockImageBlob = {
      type: 'image/png',
      arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer)
    }
    const mockImageUrl = 'blob:http://localhost/image-123'
    
    vi.mocked(MediaStore.getMedia).mockResolvedValue({
      id: 'media-1',
      type: 'image',
      url: mockImageUrl,
      blob: mockImageBlob as any,
      title: 'Test Image',
      projectId: projectId
    })
    
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [{
          id: 'media-1',
          type: 'image',
          url: mockImageUrl,
          title: 'Test Image'
        }]
      }],
      objectives: [],
      welcome: {
        title: 'Welcome',
        content: 'Welcome content',
        media: [{
          id: 'media-2',
          type: 'image',
          url: 'blob:http://localhost/welcome-image',
          title: 'Welcome Image'
        }]
      }
    }
    
    // Mock successful response
    mockInvoke.mockResolvedValue([1, 2, 3]) // Mock zip data
    
    await generateRustSCORM(courseContent, projectId)
    
    // Check that invoke was called
    expect(mockInvoke).toHaveBeenCalled()
    
    // Get the actual call arguments
    const callArgs = mockInvoke.mock.calls[0][1] as any
    const sentData = callArgs.courseData
    
    // Check that media URLs have been resolved
    expect(sentData.topics[0].media[0].url).not.toBe(mockImageUrl)
    expect(sentData.topics[0].media[0].url).toMatch(/^media\//)
    
    // Check that media files are included
    expect(callArgs).toHaveProperty('mediaFiles')
    expect(callArgs.mediaFiles).toBeInstanceOf(Array)
    expect(callArgs.mediaFiles.length).toBeGreaterThan(0)
    expect(callArgs.mediaFiles[0]).toHaveProperty('filename')
    expect(callArgs.mediaFiles[0]).toHaveProperty('content')
    expect(callArgs.mediaFiles[0].filename).toMatch(/^media\/image-\d+\.png$/)
  })

  it('should handle external URLs without modification', async () => {
    const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    const projectId = 'test-project'
    
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [{
          id: 'media-1',
          type: 'image',
          url: 'https://example.com/image.jpg',
          title: 'External Image'
        }]
      }],
      objectives: [],
      welcome: {
        title: 'Welcome',
        content: 'Welcome content'
      }
    }
    
    mockInvoke.mockResolvedValue([1, 2, 3])
    
    await generateRustSCORM(courseContent, projectId)
    
    const callArgs = mockInvoke.mock.calls[0][1] as any
    const sentData = callArgs.courseData
    
    // External URLs should remain unchanged
    expect(sentData.topics[0].media[0].url).toBe('https://example.com/image.jpg')
    
    // No media files needed for external URLs
    expect(callArgs.mediaFiles).toBeUndefined()
  })

  it('should generate unique filenames for media files', async () => {
    const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    const projectId = 'test-project'
    
    // Mock multiple media items
    const mediaItems = [
      { id: 'media-1', data: new Uint8Array([1, 2, 3]), type: 'image/png' },
      { id: 'media-2', data: new Uint8Array([4, 5, 6]), type: 'image/jpeg' },
      { id: 'media-3', data: new Uint8Array([7, 8, 9]), type: 'image/png' }
    ]
    
    mediaItems.forEach((item, index) => {
      vi.mocked(MediaStore.getMedia)
        .mockResolvedValueOnce({
          id: item.id,
          type: 'image',
          url: `blob:http://localhost/${item.id}`,
          blob: {
            type: item.type,
            arrayBuffer: vi.fn().mockResolvedValue(item.data.buffer)
          } as any,
          title: `Image ${index + 1}`,
          projectId: projectId
        })
    })
    
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: mediaItems.map((item, index) => ({
        id: `topic-${index + 1}`,
        title: `Topic ${index + 1}`,
        content: 'Content',
        media: [{
          id: item.id,
          type: 'image',
          url: `blob:http://localhost/${item.id}`,
          title: `Image ${index + 1}`
        }]
      })),
      objectives: []
    }
    
    mockInvoke.mockResolvedValue([1, 2, 3])
    
    await generateRustSCORM(courseContent, projectId)
    
    const callArgs = mockInvoke.mock.calls[0][1] as any
    
    // Check unique filenames are generated
    expect(callArgs.mediaFiles).toHaveLength(3)
    const filenames = callArgs.mediaFiles.map((f: any) => f.filename)
    expect(new Set(filenames).size).toBe(3) // All filenames should be unique
    
    // Check filename format
    expect(filenames[0]).toMatch(/^media\/image-\d+\.png$/)
    expect(filenames[1]).toMatch(/^media\/image-\d+\.jpeg$/)
    expect(filenames[2]).toMatch(/^media\/image-\d+\.png$/)
  })

  it('should handle media resolution errors gracefully', async () => {
    const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    const projectId = 'test-project'
    
    // Mock MediaStore to throw error
    vi.mocked(MediaStore.getMedia).mockRejectedValue(new Error('Media not found'))
    
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course', 
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: 'Test content',
        media: [{
          id: 'missing-media',
          type: 'image',
          url: 'blob:http://localhost/missing',
          title: 'Missing Image'
        }]
      }],
      objectives: []
    }
    
    mockInvoke.mockResolvedValue([1, 2, 3])
    
    await generateRustSCORM(courseContent, projectId)
    
    const callArgs = mockInvoke.mock.calls[0][1] as any
    const sentData = callArgs.courseData
    
    // Should still generate but with empty URL for failed media
    expect(sentData.topics[0].media[0].url).toBe('')
    expect(callArgs.mediaFiles).toBeUndefined()
  })
})