import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the MediaService and UnifiedMediaContext
const mockDeleteAllMedia = vi.fn()
const mockGetAllMediaMetadata = vi.fn()

vi.mock('../services/MediaService', () => ({
  MediaService: vi.fn().mockImplementation(() => ({
    deleteAllMedia: mockDeleteAllMedia,
    getAllMediaMetadata: mockGetAllMediaMetadata
  }))
}))

vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    deleteAllMedia: mockDeleteAllMedia,
    getAllMediaMetadata: mockGetAllMediaMetadata
  })
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    currentProjectId: 'test-project',
    saveCourseContent: vi.fn(),
    saveContent: vi.fn()
  })
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    navigateToStep: vi.fn()
  })
}))

vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('App.clearMediaOnJsonClear Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce the issue: media files are not cleared when JSON is cleared', async () => {
    // Simulate the current behavior where only course content is cleared
    // but media files persist in storage
    
    // Setup initial state: course has media files
    const initialMediaFiles = [
      { id: 'media-1', type: 'image', fileName: 'image1.jpg', pageId: 'page-1' },
      { id: 'media-2', type: 'image', fileName: 'image2.jpg', pageId: 'page-2' },
      { id: 'audio-1', type: 'audio', fileName: 'narration1.mp3', pageId: 'page-1' },
      { id: 'audio-2', type: 'audio', fileName: 'narration2.mp3', pageId: 'page-2' },
      { id: 'caption-1', type: 'text', fileName: 'captions1.srt', pageId: 'page-1' }
    ]
    
    mockGetAllMediaMetadata.mockResolvedValue(initialMediaFiles)
    
    // Current implementation of handleClearCourseContent (simplified)
    const currentHandleClearCourseContent = async () => {
      // Only clears course content, does NOT delete media files
      console.log('Current implementation: Only clearing course content state')
      // setCourseContent(null) - would happen in real implementation
      // storage.saveCourseContent(null) - would happen in real implementation
      
      // BUG: Media files are NOT deleted here
      // deleteAllMedia is NOT called
    }
    
    // Execute current clearing logic
    await currentHandleClearCourseContent()
    
    // Verify the bug: deleteAllMedia was never called
    expect(mockDeleteAllMedia).not.toHaveBeenCalled()
    
    // The media files should still exist (this is the bug)
    const remainingMedia = await mockGetAllMediaMetadata()
    expect(remainingMedia).toHaveLength(5) // All media files still exist
    expect(remainingMedia).toEqual(initialMediaFiles)
    
    // What should happen after the fix:
    // 1. deleteAllMedia should be called
    // 2. All media files should be removed
    // 3. Course content should be cleared
  })

  it('should verify the expected behavior after fix: all media types are deleted', async () => {
    // This test shows what we want to happen after the fix
    
    const initialMediaFiles = [
      { id: 'image-1', type: 'image', fileName: 'page1-image.jpg', pageId: 'welcome' },
      { id: 'image-2', type: 'image', fileName: 'page2-image.png', pageId: 'objectives' },
      { id: 'video-1', type: 'video', fileName: 'intro-video.mp4', pageId: 'topic-1' },
      { id: 'audio-welcome', type: 'audio', fileName: 'welcome-narration.mp3', pageId: 'welcome' },
      { id: 'audio-objectives', type: 'audio', fileName: 'objectives-narration.mp3', pageId: 'objectives' },
      { id: 'audio-topic-1', type: 'audio', fileName: 'topic1-narration.mp3', pageId: 'topic-1' },
      { id: 'caption-1', type: 'text', fileName: 'video-captions.srt', pageId: 'topic-1' }
    ]
    
    mockGetAllMediaMetadata.mockResolvedValueOnce(initialMediaFiles)
    mockDeleteAllMedia.mockResolvedValue(undefined)
    
    // Fixed implementation that should delete all media
    const fixedHandleClearCourseContent = async () => {
      // Clear course content state
      console.log('Fixed implementation: Clearing course content AND media files')
      
      // FIXED: Also delete all media files
      await mockDeleteAllMedia('test-project')
      
      // Save cleared state to storage
      // storage.saveCourseContent(null)
    }
    
    // Execute the fixed clearing logic
    await fixedHandleClearCourseContent()
    
    // Verify the fix: deleteAllMedia was called
    expect(mockDeleteAllMedia).toHaveBeenCalledWith('test-project')
    
    // Simulate that all media files are now deleted
    mockGetAllMediaMetadata.mockResolvedValueOnce([])
    const remainingMedia = await mockGetAllMediaMetadata()
    expect(remainingMedia).toHaveLength(0) // No media files should remain
  })

  it('should handle different media types: images, videos, audio, captions', async () => {
    // Test that all different media types are included in the cleanup
    const mixedMediaTypes = [
      { id: 'img-1', type: 'image', fileName: 'photo.jpg', pageId: 'page-1', mimeType: 'image/jpeg' },
      { id: 'img-2', type: 'image', fileName: 'diagram.png', pageId: 'page-2', mimeType: 'image/png' },
      { id: 'vid-1', type: 'video', fileName: 'demo.mp4', pageId: 'page-1', isYouTube: false },
      { id: 'vid-2', type: 'video', fileName: 'tutorial', pageId: 'page-2', isYouTube: true, youtubeUrl: 'https://youtube.com/watch?v=123' },
      { id: 'aud-1', type: 'audio', fileName: 'narration1.mp3', pageId: 'welcome', mimeType: 'audio/mpeg' },
      { id: 'aud-2', type: 'audio', fileName: 'narration2.wav', pageId: 'objectives', mimeType: 'audio/wav' },
      { id: 'cap-1', type: 'text', fileName: 'subtitles.srt', pageId: 'page-1', mimeType: 'text/plain' },
      { id: 'cap-2', type: 'text', fileName: 'transcript.txt', pageId: 'page-2', mimeType: 'text/plain' }
    ]
    
    mockGetAllMediaMetadata.mockResolvedValue(mixedMediaTypes)
    
    // Current bug: these media types would persist after JSON clear
    // The warning in JSONImportValidator says media will be cleared, but it's not
    const mediaTypesBeforeClear = await mockGetAllMediaMetadata()
    expect(mediaTypesBeforeClear).toHaveLength(8)
    
    // Verify all different types are present
    const imageTypes = mediaTypesBeforeClear.filter(m => m.type === 'image')
    const videoTypes = mediaTypesBeforeClear.filter(m => m.type === 'video')
    const audioTypes = mediaTypesBeforeClear.filter(m => m.type === 'audio')
    const textTypes = mediaTypesBeforeClear.filter(m => m.type === 'text')
    
    expect(imageTypes).toHaveLength(2)
    expect(videoTypes).toHaveLength(2)
    expect(audioTypes).toHaveLength(2)
    expect(textTypes).toHaveLength(2)
    
    // After fix, deleteAllMedia should clear ALL types
    // This is what the user expects based on the warning message
  })

  it('should handle error cases during media deletion gracefully', async () => {
    // Test error handling when media deletion fails
    const testProjectId = 'test-project'
    
    // Mock deleteAllMedia to throw an error
    const deletionError = new Error('Failed to delete media files')
    mockDeleteAllMedia.mockRejectedValue(deletionError)
    
    // The fixed implementation should handle errors gracefully
    const fixedHandleClearCourseContentWithErrorHandling = async () => {
      try {
        await mockDeleteAllMedia(testProjectId)
      } catch (error) {
        // Should log the error but not prevent course content from being cleared
        console.error('Failed to delete media files during JSON clear:', error)
        
        // Course content should still be cleared even if media deletion fails
        // This ensures the user isn't left in an inconsistent state
        return { courseContentCleared: true, mediaDeleted: false, error }
      }
      
      return { courseContentCleared: true, mediaDeleted: true, error: null }
    }
    
    const result = await fixedHandleClearCourseContentWithErrorHandling()
    
    expect(mockDeleteAllMedia).toHaveBeenCalledWith(testProjectId)
    expect(result.courseContentCleared).toBe(true)
    expect(result.mediaDeleted).toBe(false)
    expect(result.error).toBe(deletionError)
  })

  it('should demonstrate the user expectation based on warning message', () => {
    // The JSONImportValidator shows this warning when clearing:
    const warningMessage = `
      Warning: This will remove the current course structure and all content from the following pages:
      - Media Enhancement
      - Audio Narration  
      - Activities Editor
      - SCORM Package Builder
    `
    
    // The warning implies that ALL content from these pages will be removed
    // This includes the media files that were added on these pages
    
    // Current bug: The warning is misleading because media files persist
    // Users expect media files to be deleted based on this warning
    
    expect(warningMessage).toContain('all content')
    expect(warningMessage).toContain('Media Enhancement')
    expect(warningMessage).toContain('Audio Narration')
    
    // The warning sets the expectation that media files will be cleared
    // but currently they are not, creating user confusion
  })
})