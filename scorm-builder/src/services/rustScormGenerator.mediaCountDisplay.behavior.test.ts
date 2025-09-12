/**
 * FAILING TEST: Reproduces the "1 media file" vs "4 binary files" issue
 * 
 * Issue: rustScormGenerator shows "Generating SCORM package (1 media files)..." in UI
 * Expected: Should show accurate count like "Generating SCORM package (4 binary files)..."
 * 
 * User sees misleading progress messages that don't match actual media processing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRustSCORM } from './rustScormGenerator'

// Mock dependencies
vi.mock('../contexts/UnifiedMediaContext', () => ({
  createMediaService: () => ({
    listAllMedia: vi.fn().mockResolvedValue([
      // 4 images (will be binary files in SCORM)
      { id: 'image-0', type: 'image', pageId: 'welcome', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-3', type: 'image', pageId: 'topic-1', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-4', type: 'image', pageId: 'topic-2', metadata: { mimeType: 'image/jpeg' } },
      { id: 'image-5', type: 'image', pageId: 'topic-3', metadata: { mimeType: 'image/jpeg' } },
      // 3 YouTube videos (will be embedded URLs, not binary files)
      { id: 'video-1', type: 'video', pageId: 'welcome', metadata: { mimeType: 'application/json', youtubeUrl: 'https://youtube.com/watch?v=test1' } },
      { id: 'video-2', type: 'video', pageId: 'topic-1', metadata: { mimeType: 'application/json', youtubeUrl: 'https://youtube.com/watch?v=test2' } },
      { id: 'video-6', type: 'video', pageId: 'topic-3', metadata: { mimeType: 'application/json', youtubeUrl: 'https://youtube.com/watch?v=test3' } }
    ]),
    getMedia: vi.fn().mockImplementation((mediaId) => {
      if (mediaId.startsWith('image-')) {
        return Promise.resolve({
          id: mediaId,
          data: new ArrayBuffer(1000), // Mock binary data
          url: `blob:${mediaId}`,
          metadata: { mimeType: 'image/jpeg' }
        })
      }
      if (mediaId.startsWith('video-')) {
        return Promise.resolve({
          id: mediaId,
          data: null, // No binary data for YouTube videos
          url: `https://youtube.com/watch?v=test`,
          metadata: { mimeType: 'application/json', youtubeUrl: 'https://youtube.com/watch?v=test' }
        })
      }
      return Promise.resolve(null)
    })
  })
}))

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn().mockImplementation((command, args) => {
    if (command === 'generate_scorm_package') {
      // Mock successful Rust SCORM generation
      return Promise.resolve(new Uint8Array([80, 75, 3, 4])) // ZIP header
    }
    return Promise.resolve()
  })
}))

vi.mock('../services/FileStorage', () => ({
  default: {
    openProject: vi.fn().mockResolvedValue({
      projectId: '1756944000180',
      metadata: { title: 'Test Project' }
    }),
    getInstance: vi.fn().mockReturnValue({
      openProject: vi.fn().mockResolvedValue({
        projectId: '1756944000180',
        metadata: { title: 'Test Project' }
      })
    })
  },
  openProject: vi.fn().mockResolvedValue({
    projectId: '1756944000180',
    metadata: { title: 'Test Project' }
  })
}))

describe('rustScormGenerator Media Count Display', () => {
  const mockCourseContent = {
    title: 'Test Course',
    welcomePage: {
      title: 'Welcome',
      content: 'Welcome content',
      media: [{ id: 'image-0', type: 'image' }] // Only 1 media item referenced in course content
    },
    learningObjectivesPage: {
      title: 'Objectives', 
      content: 'Objectives content',
      media: [] // No media referenced
    },
    topics: [
      {
        id: 'topic-0',
        title: 'Topic 1',
        content: 'Topic content',
        media: [], // No media referenced (but storage has images for topics)
        questions: []
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FAILING TEST: Should show accurate binary file count in progress messages', async () => {
    const progressMessages: Array<[string, number]> = []
    const mockOnProgress = (message: string, progress: number) => {
      progressMessages.push([message, progress])
    }

    try {
      await generateRustSCORM(mockCourseContent, '1756944000180', mockOnProgress)
    } catch (error) {
      // May fail due to mocking, but we're testing progress messages
    }

    // Find the media count progress message
    const mediaProgressMessage = progressMessages.find(([msg]) => msg.includes('media files'))
    
    console.log('All progress messages:', progressMessages)
    console.log('Media progress message:', mediaProgressMessage)
    
    // THE BUG: Currently shows wrong count because rustScormGenerator.ts line 2130 shows:
    // `Generating SCORM package (${mediaFiles.length} media files)...`
    // But in real scenarios it shows "1 media files" when it should show "4 binary files"
    
    if (mediaProgressMessage) {
      const [message] = mediaProgressMessage
      
      // This assertion should FAIL initially, demonstrating the bug
      // Should show either accurate count or clear binary file distinction
      expect(message).toMatch(/4.*binary.*files|4.*media.*files/)
      
      // Should NOT show misleading counts like "1 media files"
      expect(message).not.toMatch(/1.*media.*files/)
    }
  })

  it('Should distinguish between binary files and embedded URLs in progress', async () => {
    const progressMessages: Array<[string, number]> = []
    const mockOnProgress = (message: string, progress: number) => {
      progressMessages.push([message, progress])
    }

    try {
      await generateRustSCORM(mockCourseContent, '1756944000180', mockOnProgress)
    } catch (error) {
      // May fail due to mocking, but we're testing progress messages
    }

    const mediaProgressMessage = progressMessages.find(([msg]) => msg.includes('media') || msg.includes('binary'))
    
    if (mediaProgressMessage) {
      const [message] = mediaProgressMessage
      
      // Should clearly indicate what type of files are being processed
      // Either "4 binary files" or "4 media files" - but NOT "1 media files"
      expect(message).toMatch(/binary.*files|[2-9].*media.*files/)
      
      // Definitely should not show the confusing "1 media files" message
      expect(message).not.toMatch(/1.*media.*files/)
    }
  })

  it('Should match console logs with UI progress messages', async () => {
    const progressMessages: Array<[string, number]> = []
    const mockOnProgress = (message: string, progress: number) => {
      progressMessages.push([message, progress])
    }

    // Spy on console.log to capture the debug output
    const consoleSpy = vi.spyOn(console, 'log')

    try {
      await generateRustSCORM(mockCourseContent, '1756944000180', mockOnProgress)
    } catch (error) {
      // May fail due to mocking, but we're testing message consistency
    }

    // Find console logs about media file count
    const mediaCountLogs = consoleSpy.mock.calls
      .filter(call => call[0]?.includes('Media files count') || call[0]?.includes('media files'))
      .map(call => call.join(' '))

    // Find progress message about media files  
    const mediaProgressMessage = progressMessages.find(([msg]) => msg.includes('media'))

    console.log('Console logs about media count:', mediaCountLogs)
    console.log('Progress message about media:', mediaProgressMessage)

    // THE ISSUE: Console logs show correct count (4) but UI progress shows wrong count (1)
    // This test documents the inconsistency that needs to be fixed
    
    if (mediaCountLogs.length > 0 && mediaProgressMessage) {
      // Both should reflect the same media file count
      // This assertion will likely FAIL, exposing the bug
      const consoleShowsCorrectCount = mediaCountLogs.some(log => log.includes('4'))
      const progressShowsCorrectCount = mediaProgressMessage[0].includes('4')
      
      expect(consoleShowsCorrectCount && progressShowsCorrectCount).toBe(true)
    }

    consoleSpy.mockRestore()
  })
})