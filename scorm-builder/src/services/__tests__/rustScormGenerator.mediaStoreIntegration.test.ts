import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from '../rustScormGenerator'
import { mediaStore } from '../MediaStore'
import type { EnhancedCourseContent } from '../../types/scorm'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock mediaUrlService
vi.mock('../mediaUrl', () => ({
  mediaUrlService: {
    getMediaUrl: vi.fn(),
    clearCache: vi.fn()
  }
}))

describe('rustScormGenerator - MediaStore Integration', () => {
  const mockProjectId = 'test-project-123'
  let mockInvoke: any
  
  beforeEach(async () => {
    mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke)
    vi.clearAllMocks()
    console.warn = vi.fn()
    console.log = vi.fn()
    
    // Clean up MediaStore
    mediaStore.cleanup()
  })

  it('should fail to resolve media when MediaStore is not loaded with project', async () => {
    // This reproduces the production issue - MediaStore has no project loaded
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        media: [{
          id: 'test-img',
          type: 'image',
          url: 'blob:http://localhost/test-image',
          title: 'Test Image'
        }]
      }]
    }

    mockInvoke.mockResolvedValue(new Array(100).fill(0))

    // Generate SCORM without loading project in MediaStore
    await generateRustSCORM(courseContent, mockProjectId)

    // Verify the warning about media not found
    expect(console.warn).toHaveBeenCalledWith(
      '[Rust SCORM] Media not found in store: test-img'
    )

    // Verify empty URL was sent to Rust
    const [, invokeArgs] = mockInvoke.mock.calls[0]
    expect(invokeArgs.courseData.topics[0].media[0].url).toBe('')
  })

  it('should properly resolve media when MediaStore is loaded with correct project', async () => {
    const courseContent: EnhancedCourseContent = {
      title: 'Test Course',
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Content',
        media: [{
          id: 'test-img',
          type: 'image',
          url: 'scorm-media://test-project-123/test-img', // Protocol URL from new MediaStore
          title: 'Test Image'
        }]
      }]
    }

    // Mock the backend loading
    mockInvoke.mockImplementation(async (command: string, args: any) => {
      if (command === 'load_project_media') {
        return [{
          id: 'test-img',
          page_id: 'topic-1',
          type: 'image',
          original_name: 'test.png',
          file_name: 'test-img.png'
        }]
      }
      if (command === 'get_media') {
        return new Array(1000).fill(0) // Mock binary data
      }
      if (command === 'generate_scorm_enhanced') {
        return new Array(100).fill(0) // Mock SCORM package
      }
      return null
    })

    // Load project in MediaStore first
    await mediaStore.loadProject(mockProjectId)

    // Now generate SCORM
    await generateRustSCORM(courseContent, mockProjectId)

    // The new MediaStore uses protocol URLs, not blob URLs
    // So the rustScormGenerator needs to handle these differently
    const [, invokeArgs] = mockInvoke.mock.calls.find(
      call => call[0] === 'generate_scorm_enhanced'
    )
    
    // Media should have the protocol URL preserved
    expect(invokeArgs.courseData.topics[0].media[0].url).toBe('scorm-media://test-project-123/test-img')
  })

  it('should handle the MediaStore refactoring properly', async () => {
    // The issue is that rustScormGenerator is using MediaStore.getMedia (static method)
    // but the new MediaStore only has instance methods on mediaStore (lowercase)
    
    // This test verifies the actual API mismatch
    expect(typeof mediaStore.getMedia).toBe('function') // Instance method exists
    expect((MediaStore as any).getMedia).toBeUndefined() // Static method doesn't exist
  })
})